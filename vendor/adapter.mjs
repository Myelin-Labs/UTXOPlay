// Vendor-owned HTTP boundary. Run next to your private Myelin game runtime.
import express from "express";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import WebSocket, { WebSocketServer } from "ws";
export function createVendorAdapter({
  storeOrigin,
  projectId,
  verificationToken,
  vendorKey,
  publicOrigin,
  gameUrl,
  runtimeUrl,
  runtimeToken,
  myelinVersion,
  sessionSecret,
  webRoot,
  fetchImpl = fetch,
  secureCookies = true,
}) {
  for (const [name, value] of Object.entries({
    storeOrigin,
    projectId,
    verificationToken,
    vendorKey,
    publicOrigin,
    gameUrl,
    runtimeUrl,
    runtimeToken,
    myelinVersion,
    sessionSecret,
    webRoot,
  }))
    if (!value) throw Error("Missing vendor configuration: " + name);
  if (sessionSecret.length < 32 || runtimeToken.length < 32)
    throw Error(
      "Session and runtime secrets must contain at least 32 characters.",
    );
  const pub = new URL(publicOrigin);
  if (
    pub.protocol !== "https:" ||
    pub.pathname !== "/" ||
    new URL(gameUrl).origin !== pub.origin
  )
    throw Error("Use a public HTTPS origin and a game URL on that origin.");
  const storefront = new URL(storeOrigin);
  if (
    storefront.protocol !== "https:" &&
    !(
      storefront.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(storefront.hostname)
    )
  )
    throw Error("Invalid store origin.");
  const base = runtimeUrl.replace(/\/$/, ""),
    gamePath = new URL(gameUrl).pathname.replace(/\/$/, "") || "/game";
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  });
  const sign = (v) =>
    createHmac("sha256", sessionSecret).update(v).digest("base64url");
  function readSession(req) {
    try {
      const value = (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("utxov_session="))
        ?.slice(14);
      if (!value) return null;
      const [payload, mac] = value.split(".");
      const expected = sign(payload);
      if (
        !mac ||
        mac.length !== expected.length ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
      )
        return null;
      const d = JSON.parse(Buffer.from(payload, "base64url"));
      return d.expires > Date.now() && /^[a-f0-9]{64}$/.test(d.player)
        ? d
        : null;
    } catch {
      return null;
    }
  }
  const authorize = (req, res, next) => {
    req.player = readSession(req);
    if (!req.player)
      return res
        .status(401)
        .type("html")
        .send(
          `<h1>Start this game from UTXOPlay</h1><p>Your game access has expired or is not connected.</p><a href="${storefront.origin}/play/vendor-${projectId}">Return to the game page</a>`,
        );
    next();
  };
  const headers = (player) => ({
    "Content-Type": "application/json",
    "X-Runtime-Token": runtimeToken,
    "X-UTXOPlay-Account": player,
  });
  let cachedHealth = null;
  app.get("/.well-known/utxoplay.json", async (_req, res) => {
    try {
      if (!cachedHealth || cachedHealth.until < Date.now()) {
        const result = await fetchImpl(base + "/api/state", {
          headers: headers(
            createHash("sha256")
              .update("utxoplay-health:" + projectId)
              .digest("hex"),
          ),
          signal: AbortSignal.timeout(5000),
        });
        if (!result.ok) throw Error("Runtime unavailable");
        const state = await result.json();
        if (!state || typeof state !== "object" || state.error)
          throw Error("Invalid runtime response");
        cachedHealth = { until: Date.now() + 10000 };
      }
      res.json({
        protocol: "utxoplay.vendor.v1",
        projectId,
        verificationToken,
        keyFingerprint: createHash("sha256").update(vendorKey).digest("hex"),
        runtime: { name: "myelin", version: myelinVersion },
        gameUrl: gameUrl.replace(/\/$/, ""),
        launchUrl: pub.origin + "/utxoplay/launch",
        status: "ready",
      });
    } catch {
      res.status(503).json({
        protocol: "utxoplay.vendor.v1",
        status: "unavailable",
        error: "The private Myelin runtime is not responding.",
      });
    }
  });
  app.post(
    "/utxoplay/launch",
    express.urlencoded({ extended: false, limit: "2kb" }),
    async (req, res) => {
      if (req.headers.origin !== storefront.origin)
        return res
          .status(403)
          .send("Launch from the configured UTXOPlay store.");
      try {
        if (
          typeof req.body.ticket !== "string" ||
          !/^[a-f0-9]{64}$/.test(req.body.ticket)
        )
          throw Error("Invalid ticket");
        const response = await fetchImpl(
          storefront.origin + "/api/vendor/redeem",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + vendorKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ticket: req.body.ticket }),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) throw Error("Ticket exchange failed");
        const d = await response.json();
        if (
          d.projectId !== projectId ||
          !/^[a-f0-9]{64}$/.test(d.player) ||
          !Number.isSafeInteger(d.expires) ||
          d.expires <= Date.now()
        )
          throw Error("Invalid launch grant");
        const payload = Buffer.from(
          JSON.stringify({
            player: d.player,
            expires: Math.min(d.expires, Date.now() + 86400000),
          }),
        ).toString("base64url");
        res.cookie("utxov_session", payload + "." + sign(payload), {
          httpOnly: true,
          secure: secureCookies,
          sameSite: "lax",
          path: "/",
          maxAge: 86400000,
        });
        res.redirect(303, gameUrl);
      } catch {
        res
          .status(401)
          .type("html")
          .send(
            `<h1>Let’s reconnect your game</h1><p>The launch expired or could not be verified. You have not been charged again.</p><a href="${storefront.origin}/play/vendor-${projectId}">Launch again from UTXOPlay</a>`,
          );
      }
    },
  );
  app.use(
    [gamePath + "/api", "/api"],
    express.json({ limit: "24kb" }),
    authorize,
    async (req, res) => {
      if (
        !["GET", "POST"].includes(req.method) ||
        !["/state", "/export", "/new", "/action", "/replay"].includes(req.path)
      )
        return res.status(404).json({ error: "Unknown game endpoint" });
      if (req.method === "POST" && req.headers.origin !== pub.origin)
        return res.status(403).json({ error: "Game origin rejected" });
      try {
        const result = await fetchImpl(base + "/api" + req.path, {
          method: req.method,
          headers: headers(req.player.player),
          body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
          signal: AbortSignal.timeout(20000),
        });
        res
          .status(result.status)
          .type("json")
          .send(await result.text());
      } catch {
        res.status(503).json({
          error: "The game runtime is unavailable. Please try again.",
        });
      }
    },
  );
  app.use(
    gamePath,
    authorize,
    express.static(path.resolve(webRoot), { index: "index.html", maxAge: 0 }),
  );
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const attach = (server) => {
    server.on("upgrade", (req, socket, head) => {
      const session = readSession(req);
      if (
        ![gamePath + "/api/socket", "/api/socket"].includes(req.url) ||
        req.headers.origin !== pub.origin ||
        !session
      ) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      sockets.handleUpgrade(req, socket, head, (downstream) => {
        const upstream = new WebSocket(
          base.replace(/^http/, "ws") + "/api/socket",
          {
            headers: headers(session.player),
            maxPayload: 256 * 1024,
            handshakeTimeout: 5000,
          },
        );
        let count = 0;
        const rate = setInterval(() => (count = 0), 1000);
        const expiry = setTimeout(
          () => downstream.close(1008, "Launch session expired"),
          Math.max(1, session.expires - Date.now()),
        );
        downstream.on("message", (data, binary) => {
          if (binary || ++count > 120) {
            downstream.close(1008, "Input limit");
            return;
          }
          if (upstream.readyState === WebSocket.OPEN)
            upstream.send(data, { binary: false });
        });
        upstream.on("message", (data, binary) => {
          if (downstream.readyState === WebSocket.OPEN)
            downstream.send(data, { binary });
        });
        const end = () => {
          clearInterval(rate);
          clearTimeout(expiry);
          upstream.terminate();
          downstream.terminate();
        };
        downstream.on("close", end);
        downstream.on("error", end);
        upstream.on("error", end);
        upstream.on("close", end);
      });
    });
  };
  return {
    app,
    attach,
    close: () => {
      for (const client of sockets.clients) client.terminate();
      sockets.close();
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const e = process.env,
    adapter = createVendorAdapter({
      storeOrigin: e.UTXOPLAY_STORE_ORIGIN,
      projectId: e.UTXOPLAY_PROJECT_ID,
      verificationToken: e.UTXOPLAY_VERIFICATION_TOKEN,
      vendorKey: e.UTXOPLAY_VENDOR_KEY,
      publicOrigin: e.VENDOR_PUBLIC_ORIGIN,
      gameUrl: e.VENDOR_GAME_URL,
      runtimeUrl: e.MYELIN_RUNTIME_URL,
      runtimeToken: e.MYELIN_RUNTIME_TOKEN,
      myelinVersion: e.MYELIN_VERSION,
      sessionSecret: e.VENDOR_SESSION_SECRET,
      webRoot: e.VENDOR_WEB_ROOT,
    });
  const server = adapter.app.listen(
    Number(e.PORT || 8800),
    e.BIND || "127.0.0.1",
    () => console.log("UTXOPlay vendor adapter ready"),
  );
  adapter.attach(server);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      adapter.close();
      server.close(() => process.exit(0));
    });
}
