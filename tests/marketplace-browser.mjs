// Disposable, localhost-only interaction fixture. Never run on a public bind address.
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ccc } from "@ckb-ccc/shell";
import { createApp } from "../server/index.mjs";
const port = Number(process.env.TEST_PORT || 8795),
  origin = "http://127.0.0.1:" + port,
  dir = mkdtempSync(path.join(tmpdir(), "utxoplay-browser-fixture-"));
const owner = ccc.ClientPublicMainnet.open(),
  signer = new ccc.SignerCkbPrivateKey(
    owner.value,
    "0x" + randomBytes(32).toString("hex"),
  ),
  address = await signer.getRecommendedAddress();
let service;
service = createApp({
  dataDir: dir,
  origin,
  marketplaceOptions: {
    storeAddress: address,
    startWorker: false,
    chain: {
      address: (a) => ccc.Address.fromString(a, owner.value),
      tip: async () => "99",
      inspect: async () => ({ status: "pending", confirmations: 0 }),
      close() {},
    },
    manifestFetch: async () => {
      const p = service.db
          .prepare(
            "SELECT p.id,l.* FROM projects p JOIN listings l ON p.id=l.project ORDER BY p.created DESC LIMIT 1",
          )
          .get(),
        d = JSON.parse(p.draft);
      return {
        protocol: "utxoplay.vendor.v1",
        projectId: p.id,
        verificationToken: p.verification,
        keyFingerprint: p.key_hash,
        runtime: { name: "myelin", version: "fixture" },
        status: "ready",
        gameUrl: d.gameUrl,
        launchUrl: d.runtimeUrl + "/utxoplay/launch",
      };
    },
  },
});
const app = express();
app.get("/__test", (_req, res) =>
  res
    .type("html")
    .send(
      '<h1>Local marketplace interaction fixture</h1><p>Disposable database and signing key. Instance checks are simulated. No payments or public listings.</p><form method="post" action="/__test/login"><button>Sign in as test vendor</button></form>',
    ),
);
app.post("/__test/login", async (_req, res) => {
  try {
    const challenge = await fetch(origin + "/api/auth/challenge", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const cookie = challenge.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; "),
      d = await challenge.json();
    const verified = await fetch(origin + "/api/auth/verify", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        id: d.id,
        proof: await signer.signMessage(d.message),
      }),
    });
    if (!verified.ok) throw Error("Fixture login failed");
    for (const c of verified.headers.getSetCookie())
      res.append("Set-Cookie", c);
    res.redirect("/developers");
  } catch {
    res.status(500).send("Fixture sign-in failed.");
  }
});
app.use(service.app);
const server = app.listen(port, "127.0.0.1", () =>
  console.log("Local-only fixture:", origin + "/__test"),
);
service.attachSockets(server);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    service.close();
    server.close(async () => {
      await owner.dispose();
      rmSync(dir, { recursive: true, force: true });
      process.exit(0);
    });
  });
