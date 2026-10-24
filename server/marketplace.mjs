import { randomBytes } from "node:crypto";
import { ccc } from "@ckb-ccc/shell";
import { digest } from "./auth.mjs";
import { publicHttps, fetchVendorManifest } from "./vendor-network.mjs";
import {
  createChainReader,
  parsePrice,
  formatCkb,
  splitPrice,
  minimumPrice,
  validatePaymentTransaction,
  jsonSafe,
  CONFIRMATIONS,
} from "./commerce.mjs";
const token = () => randomBytes(32).toString("hex");
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
const initial = (p) => ({
  title: p.title,
  description: p.description,
  gameUrl: p.url,
  runtimeUrl: "",
  version: "1.0.0",
  genre: "Arcade",
  players: "Single player",
  controls: "",
  pricing: "free",
  priceCkb: "",
  payoutAddress: "",
  developerName: "",
  developerAddress: "",
  publisherName: "",
  supportUrl: "",
  refundUrl: "",
});
export function installMarketplace({
  app,
  db,
  account,
  needUser,
  limited,
  origin,
  builtinGames,
  manifestFetch = fetchVendorManifest,
  chain = createChainReader(),
  storeAddress = process.env.STORE_CKB_ADDRESS || "",
  startWorker = true,
}) {
  db.exec(`CREATE TABLE IF NOT EXISTS listings(project TEXT PRIMARY KEY REFERENCES projects(id),draft TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,live TEXT,listed INTEGER NOT NULL DEFAULT 0,checked_revision INTEGER,checked_at INTEGER,check_error TEXT,verification TEXT NOT NULL,key_hash TEXT,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,buyer TEXT NOT NULL REFERENCES accounts(id),game TEXT NOT NULL,vendor TEXT NOT NULL,price TEXT NOT NULL,quote TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'created',tx_hash TEXT UNIQUE,prepared TEXT,created_tip TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,confirmed INTEGER,confirmations INTEGER NOT NULL DEFAULT 0,error TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS one_open_order ON orders(buyer,game) WHERE status IN ('created','prepared','pending','confirming');
 CREATE TABLE IF NOT EXISTS entitlements(account TEXT NOT NULL,game TEXT NOT NULL,kind TEXT NOT NULL,order_id TEXT UNIQUE,active INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,PRIMARY KEY(account,game));
 CREATE TABLE IF NOT EXISTS launch_tickets(hash TEXT PRIMARY KEY,project TEXT NOT NULL,player TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS orders_vendor ON orders(vendor,created);`);
  for (const p of db.prepare("SELECT * FROM projects").all())
    db.prepare(
      "INSERT OR IGNORE INTO listings(project,draft,verification,updated) VALUES(?,?,?,?)",
    ).run(p.id, JSON.stringify(initial(p)), token(), Date.now());
  if (
    !db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .some((c) => c.name === "checked")
  )
    db.exec("ALTER TABLE orders ADD COLUMN checked INTEGER NOT NULL DEFAULT 0");
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      res
        .status(e.status || 400)
        .json({ error: e.message || "Unable to complete this action." });
    }
  };
  const vendor = (req, res, next) =>
    needUser(req, res, () =>
      req.account.address
        ? next()
        : res
            .status(403)
            .json({ error: "Connect a wallet to manage a vendor project." }),
    );
  const find = (id) =>
    db
      .prepare(
        "SELECT p.*,l.draft,l.revision,l.live,l.listed,l.checked_revision,l.checked_at,l.check_error,l.verification,l.key_hash,l.updated FROM projects p JOIN listings l ON l.project=p.id WHERE p.id=?",
      )
      .get(id);
  function owned(req) {
    const p = find(req.params.id);
    if (!p || p.owner !== req.account.id) throw fail("Project not found.", 404);
    return p;
  }
  // Publishing authority comes from the authenticated project owner, never credits or payouts.
  function credits(p, d) {
    const owner = db.prepare("SELECT address FROM accounts WHERE id=?").get(p.owner);
    return {
      developer: { name: d.developerName || "Not specified", address: d.developerAddress || null },
      publisher: { name: d.publisherName || "Independent publisher", address: owner?.address || null },
    };
  }
  function view(p) {
    return {
      id: p.id,
      owner: p.owner,
      draft: { ...initial(p), ...JSON.parse(p.draft) },
      ...credits(p, JSON.parse(p.draft)),
      revision: p.revision,
      live: p.live ? JSON.parse(p.live) : null,
      status: p.listed ? "published" : p.live ? "unlisted" : "draft",
      checkedRevision: p.checked_revision,
      checkedAt: p.checked_at,
      checkError: p.check_error,
      verificationToken: p.verification,
      keyConfigured: !!p.key_hash,
      keyFingerprint: p.key_hash,
      updated: p.updated,
    };
  }
  function gameView(p) {
    const d = JSON.parse(p.live);
    return {
      id: "vendor-" + p.id,
      projectId: p.id,
      ...credits(p, d),
      title: d.title,
      subtitle:
        d.pricing === "free"
          ? "Free to play. Made by an independent creator."
          : "Buy once. Return whenever you like.",
      description: d.description,
      genre: d.genre,
      mode: d.players,
      players: d.players,
      controls: d.controls,
      cover: "/assets/vendor-cover.svg",
      headline: d.title,
      heroDescription: d.description,
      version: d.version,
      vendor: true,
      available: !!p.listed,
      pricing: d.pricing,
      priceCkb: d.pricing === "free" ? "0" : d.priceCkb,
      host: new URL(d.runtimeUrl).host,
      supportUrl: d.supportUrl,
      refundUrl: d.refundUrl,
    };
  }
  function fromGame(id) {
    if (typeof id !== "string" || !id.startsWith("vendor-"))
      throw fail("Game not found.", 404);
    const p = find(id.slice(7));
    if (!p?.live) throw fail("Game not found.", 404);
    return p;
  }
  const entitlement = (buyer, game) =>
    db
      .prepare("SELECT * FROM entitlements WHERE account=? AND game=?")
      .get(buyer, game);
  function catalog() {
    return db
      .prepare(
        "SELECT project FROM listings WHERE listed=1 AND live IS NOT NULL ORDER BY updated DESC",
      )
      .all()
      .map((r) => gameView(find(r.project)));
  }
  function library(a) {
    const plays = db
      .prepare("SELECT game,updated FROM plays WHERE account=?")
      .all(a);
    const grants = db
      .prepare("SELECT game,created FROM entitlements WHERE account=?")
      .all(a);
    const rows = new Map(plays.map((p) => [p.game, p]));
    for (const e of grants)
      if (!rows.has(e.game))
        rows.set(e.game, { game: e.game, updated: e.created });
    return [...rows.values()]
      .map((r) => {
        if (r.game.startsWith("vendor-")) {
          try {
            return {
              ...r,
              details: gameView(fromGame(r.game)),
              owned: !!entitlement(a, r.game)?.active,
            };
          } catch {
            return null;
          }
        }
        return r;
      })
      .filter(Boolean)
      .sort((a, b) => b.updated - a.updated);
  }
  async function priceInfo(d) {
    const vendor = await chain.address(d.payoutAddress);
    const split = splitPrice(parsePrice(d.priceCkb));
    if (!storeAddress) return { ...split, configured: false, minimumCkb: null };
    const store = await chain.address(storeAddress),
      min = minimumPrice(store.script, vendor.script);
    return {
      ...split,
      configured: true,
      minimumCkb: formatCkb(min),
      storeLock: jsonSafe(store.script),
      vendorLock: jsonSafe(vendor.script),
      valid: BigInt(split.total) >= min,
    };
  }
  async function validateDraft(input, p) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw fail("Provide a project draft.");
    for (const key of ["publisherAddress", "publisher", "developer", "owner", "portedBy"])
      if (Object.hasOwn(input, key))
        throw fail("Publisher wallet and project ownership are set by the signed-in account. Use the credit name fields.");
    const current = p ? JSON.parse(p.draft) : {};
    const d = {
      ...initial({ title: "", description: "", url: "" }),
      ...current,
    };
    for (const k of Object.keys(d))
      if (input[k] !== undefined) {
        if (typeof input[k] !== "string")
          throw fail("Project fields must be text.");
        d[k] = input[k].trim();
      }
    if (input.url !== undefined) d.gameUrl = input.url;
    for (const key of ["developerName", "publisherName"])
      if (d[key].length > 80 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(d[key]))
        throw fail("Credit names must be at most 80 characters, without control characters.");
    if (d.developerAddress) {
      if (!d.developerName) throw fail("Add a developer name with the developer wallet.");
      if (!d.developerAddress.startsWith("ckb1") || d.developerAddress.length > 300)
        throw fail("Use a valid CKB mainnet developer address, or leave it blank if unknown.");
      try { await chain.address(d.developerAddress); }
      catch { throw fail("Use a valid CKB mainnet developer address, or leave it blank if unknown."); }
    }
    if (
      d.title.length < 3 ||
      d.title.length > 80 ||
      d.description.length > 2000 ||
      d.controls.length > 1200
    )
      throw fail(
        "Use a title of 3–80 characters, a description up to 2,000, and controls up to 1,200.",
      );
    for (const key of ["gameUrl", "runtimeUrl", "supportUrl", "refundUrl"])
      if (d[key]) d[key] = publicHttps(d[key]);
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(d.version))
      throw fail("Use a version such as 1.0.0.");
    if (
      !["Action", "Arcade", "Strategy", "Puzzle", "Other"].includes(d.genre) ||
      ![
        "Single player",
        "Local multiplayer",
        "Online multiplayer",
        "Solo + multiplayer",
      ].includes(d.players)
    )
      throw fail("Choose a supported genre and play style.");
    if (!["free", "paid"].includes(d.pricing))
      throw fail("Choose free or paid.");
    if (d.pricing === "paid" && d.priceCkb) parsePrice(d.priceCkb);
    if (d.payoutAddress.length > 300) throw fail("Invalid receive address.");
    return d;
  }
  async function check(p) {
    const d = JSON.parse(p.draft);
    if (!d.runtimeUrl || !d.gameUrl || !d.description || !d.controls)
      throw fail(
        "Add your game URL, Myelin instance URL, description and controls first.",
      );
    if (new URL(d.gameUrl).origin !== new URL(d.runtimeUrl).origin)
      throw fail("Host the game and its launch adapter on the same origin.");
    if (new URL(d.runtimeUrl).origin === origin)
      throw fail("Provide your own hosted instance, not the store address.");
    if (!p.key_hash)
      throw fail("Generate and install your vendor access key first.");
    const m = await manifestFetch(d.runtimeUrl);
    if (
      m.protocol !== "utxoplay.vendor.v1" ||
      m.projectId !== p.id ||
      m.verificationToken !== p.verification ||
      m.gameUrl !== d.gameUrl ||
      m.launchUrl !== d.runtimeUrl + "/utxoplay/launch" ||
      m.runtime?.name !== "myelin" ||
      typeof m.runtime.version !== "string" ||
      m.status !== "ready" ||
      m.keyFingerprint !== p.key_hash
    )
      throw fail(
        "The instance manifest does not match this project, or its Myelin runtime is not ready. Check the setup guide.",
      );
    const current = find(p.id);
    if (current.revision !== p.revision || current.key_hash !== p.key_hash)
      throw fail(
        "The draft changed during the check. Check the latest revision.",
        409,
      );
    db.prepare(
      "UPDATE listings SET checked_revision=?,checked_at=?,check_error=NULL WHERE project=?",
    ).run(p.revision, Date.now(), p.id);
    return m;
  }
  function orderView(o) {
    const q = JSON.parse(o.quote);
    return {
      id: o.id,
      game: o.game,
      title: q.game.title,
      status: o.status,
      priceCkb: formatCkb(o.price),
      ...splitPrice(o.price),
      storeAddress: q.storeAddress,
      vendorAddress: q.vendorAddress,
      created: o.created,
      expires: o.expires,
      txHash: o.tx_hash,
      confirmations: o.confirmations,
      requiredConfirmations: CONFIRMATIONS,
      error: o.error,
      supportUrl: q.game.supportUrl,
      refundUrl: q.game.refundUrl,
      transaction: o.prepared ? JSON.parse(o.prepared) : null,
      outputs: [
        { capacity: splitPrice(o.price).store, lock: q.storeLock },
        { capacity: splitPrice(o.price).vendor, lock: q.vendorLock },
      ],
    };
  }
  const pendingChecks = new Map();
  async function reconcile(o) {
    if (!o.tx_hash) return o;
    if (pendingChecks.has(o.id)) return pendingChecks.get(o.id);
    const task = (async () => {
      let result;
      db.prepare("UPDATE orders SET checked=? WHERE id=?").run(
        Date.now(),
        o.id,
      );
      try {
        result = await Promise.race([
          chain.inspect(o),
          new Promise((_, reject) => {
            const t = setTimeout(
              () =>
                reject(
                  Error(
                    "The CKB network check timed out. Try again; do not pay twice.",
                  ),
                ),
              12000,
            );
            t.unref();
          }),
        ]);
      } catch (e) {
        if (!stopped)
          db.prepare("UPDATE orders SET error=? WHERE id=?").run(
            "Payment check unavailable: " + e.message,
            o.id,
          );
        throw fail(
          "Unable to verify this payment now. Your order is saved; retry without paying again.",
          503,
        );
      }
      if (stopped) return o;
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          "UPDATE orders SET status=?,confirmations=?,confirmed=CASE WHEN ?='confirmed' THEN COALESCE(confirmed,?) ELSE confirmed END,error=NULL WHERE id=?",
        ).run(
          result.status,
          result.confirmations || 0,
          result.status,
          Date.now(),
          o.id,
        );
        if (result.status === "confirmed")
          db.prepare(
            "INSERT INTO entitlements(account,game,kind,order_id,active,created) VALUES(?,?,'paid',?,1,?) ON CONFLICT(account,game) DO UPDATE SET active=1,order_id=excluded.order_id WHERE entitlements.kind='paid'",
          ).run(o.buyer, o.game, o.id, Date.now());
        else
          db.prepare("UPDATE entitlements SET active=0 WHERE order_id=?").run(
            o.id,
          );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return db.prepare("SELECT * FROM orders WHERE id=?").get(o.id);
    })();
    pendingChecks.set(o.id, task);
    try {
      return await task;
    } finally {
      pendingChecks.delete(o.id);
    }
  }
  function buyerOrder(req) {
    const o = db
      .prepare("SELECT * FROM orders WHERE id=? AND buyer=?")
      .get(req.params.id, req.account.id);
    if (!o) throw fail("Order not found.", 404);
    return o;
  }
  app.get(
    "/api/commerce/config",
    wrap(async (_req, res) =>
      res.json({
        network: "ckb-mainnet",
        currency: "CKB",
        storePercent: 20,
        vendorPercent: 80,
        confirmations: CONFIRMATIONS,
        configured: !!storeAddress,
        storeAddress: storeAddress || null,
      }),
    ),
  );
  app.get("/api/developer/projects", needUser, (req, res) =>
    res.json({
      projects: db
        .prepare("SELECT id FROM projects WHERE owner=? ORDER BY created DESC")
        .all(req.account.id)
        .map((p) => view(find(p.id))),
    }),
  );
  app.post(
    "/api/developer/projects",
    vendor,
    wrap(async (req, res) => {
      const d = await validateDraft(req.body);
      if (
        db
          .prepare("SELECT count(*) n FROM projects WHERE owner=?")
          .get(req.account.id).n >= 10
      )
        throw fail("Project limit reached.", 429);
      const id = randomBytes(12).toString("hex");
      db.exec("BEGIN");
      try {
        db.prepare(
          "INSERT INTO projects(id,owner,title,description,url,created) VALUES(?,?,?,?,?,?)",
        ).run(
          id,
          req.account.id,
          d.title,
          d.description,
          d.gameUrl,
          Date.now(),
        );
        db.prepare(
          "INSERT INTO listings(project,draft,verification,updated) VALUES(?,?,?,?)",
        ).run(id, JSON.stringify(d), token(), Date.now());
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      res.status(201).json(view(find(id)));
    }),
  );
  app.post(
    "/api/developer/projects/:id/save",
    vendor,
    wrap(async (req, res) => {
      const p = owned(req);
      if (req.body.revision !== p.revision)
        throw fail(
          "This project changed in another tab. Reload before editing.",
          409,
        );
      const d = await validateDraft(req.body.draft || {}, p);
      // Address validation may yield; preserve optimistic concurrency across it.
      if (find(p.id).revision !== p.revision)
        throw fail("This project changed in another tab. Reload before editing.", 409);
      db.prepare(
        "UPDATE listings SET draft=?,revision=revision+1,check_error=NULL,updated=? WHERE project=?",
      ).run(JSON.stringify(d), Date.now(), p.id);
      res.json(view(find(p.id)));
    }),
  );
  app.post(
    "/api/developer/projects/:id/key",
    vendor,
    wrap(async (req, res) => {
      const p = owned(req);
      if (limited("vendor-key:" + p.id, 10, 3600000))
        throw fail("Please wait before rotating this key again.", 429);
      const key = "utxov_" + token();
      db.prepare(
        "UPDATE listings SET key_hash=?,checked_revision=NULL WHERE project=?",
      ).run(digest(key), p.id);
      res.json({ key, project: view(find(p.id)) });
    }),
  );
  app.post(
    "/api/developer/projects/:id/check",
    vendor,
    wrap(async (req, res) => {
      const p = owned(req);
      if (limited("vendor-check:" + p.id, 12, 60000))
        throw fail("Please wait before checking again.", 429);
      try {
        await check(p);
        res.json(view(find(p.id)));
      } catch (e) {
        if (find(p.id).revision === p.revision)
          db.prepare("UPDATE listings SET check_error=? WHERE project=?").run(
            e.message,
            p.id,
          );
        throw e;
      }
    }),
  );
  app.post(
    "/api/developer/projects/:id/price",
    vendor,
    wrap(async (req, res) => {
      const p = owned(req);
      res.json(await priceInfo(JSON.parse(p.draft)));
    }),
  );
  app.post(
    "/api/developer/projects/:id/publish",
    vendor,
    wrap(async (req, res) => {
      const p = owned(req);
      if (req.body.revision !== p.revision)
        throw fail("Review the current draft before publishing.", 409);
      if (limited("publish:" + p.id, 8, 60000))
        throw fail("Please wait before publishing again.", 429);
      const d = JSON.parse(p.draft);
      if (d.pricing === "paid") {
        if (!d.supportUrl || !d.refundUrl)
          throw fail("Paid games need support and refund-policy URLs.");
        const info = await priceInfo(d);
        if (!info.configured)
          throw fail(
            "Store settlement is awaiting its CKB receive address. Publish free now, or keep this paid draft.",
            503,
          );
        if (!info.valid)
          throw fail(
            "This direct split needs a price of at least " +
              info.minimumCkb +
              " CKB.",
          );
      }
      await check(p);
      db.prepare(
        "UPDATE listings SET live=draft,listed=1,updated=? WHERE project=? AND revision=?",
      ).run(Date.now(), p.id, p.revision);
      res.json(view(find(p.id)));
    }),
  );
  app.post(
    "/api/developer/projects/:id/unpublish",
    vendor,
    wrap(async (req, res) => {
      const p = owned(req);
      db.prepare("UPDATE listings SET listed=0,updated=? WHERE project=?").run(
        Date.now(),
        p.id,
      );
      res.json(view(find(p.id)));
    }),
  );
  app.get("/api/developer/sales", vendor, (req, res) => {
    const rows = db
      .prepare(
        "SELECT * FROM orders WHERE vendor=? ORDER BY created DESC LIMIT 200",
      )
      .all(req.account.id);
    const confirmed = db
      .prepare("SELECT price FROM orders WHERE vendor=? AND status='confirmed'")
      .all(req.account.id);
    const total = confirmed.reduce(
      (s, o) => s + BigInt(splitPrice(o.price).vendor),
      0n,
    );
    res.json({
      vendorCkb: formatCkb(total),
      sales: rows.map((o) => {
        const v = orderView(o);
        delete v.transaction;
        delete v.outputs;
        return v;
      }),
    });
  });
  app.get(
    "/api/games/:id",
    wrap(async (req, res) => {
      const p = fromGame(req.params.id),
        a = account(req);
      if ((!p.listed && !a) || (!p.listed && !entitlement(a.id, req.params.id)))
        throw fail("Game is no longer listed.", 404);
      res.json({ game: gameView(p) });
    }),
  );
  app.get("/api/orders", vendor, (req, res) =>
    res.json({
      orders: db
        .prepare(
          "SELECT * FROM orders WHERE buyer=? ORDER BY created DESC LIMIT 100",
        )
        .all(req.account.id)
        .map(orderView),
    }),
  );
  app.post(
    "/api/orders",
    vendor,
    wrap(async (req, res) => {
      const p = fromGame(req.body.game),
        d = JSON.parse(p.live),
        game = "vendor-" + p.id;
      if (!p.listed) throw fail("This game is no longer accepting purchases.");
      const grant = entitlement(req.account.id, game);
      if (grant?.active) return res.json({ owned: true });
      if (d.pricing !== "paid")
        throw fail("This game is free. Choose Play instead.");
      const existing = db
        .prepare(
          "SELECT * FROM orders WHERE buyer=? AND game=? AND status IN ('created','prepared','pending','confirming')",
        )
        .get(req.account.id, game);
      if (existing) return res.json({ order: orderView(existing) });
      if (!storeAddress)
        throw fail(
          "Payments are not configured yet. No funds have been requested.",
          503,
        );
      if (limited("order:" + req.account.id, 20, 3600000))
        throw fail("Please wait before creating more orders.", 429);
      const info = await priceInfo(d);
      if (!info.valid)
        throw fail(
          "The seller needs to update this price before it can be purchased.",
        );
      const m = await manifestFetch(d.runtimeUrl);
      if (
        m.projectId !== p.id ||
        m.verificationToken !== p.verification ||
        m.status !== "ready" ||
        m.protocol !== "utxoplay.vendor.v1" ||
        m.keyFingerprint !== p.key_hash ||
        m.gameUrl !== d.gameUrl ||
        m.launchUrl !== d.runtimeUrl + "/utxoplay/launch" ||
        m.runtime?.name !== "myelin"
      )
        throw fail(
          "The vendor instance is unavailable. Please try again later.",
          503,
        );
      const buyer = await chain.address(req.account.address),
        tip = await chain.tip(),
        id = randomBytes(16).toString("hex"),
        now = Date.now();
      const quote = {
        game: gameView(p),
        storeAddress,
        vendorAddress: d.payoutAddress,
        storeLock: info.storeLock,
        vendorLock: info.vendorLock,
        buyerLock: jsonSafe(buyer.script),
      };
      const latest = find(p.id);
      if (
        !latest.listed ||
        latest.live !== p.live ||
        latest.key_hash !== p.key_hash
      )
        throw fail(
          "The listing changed. Reload the game before purchasing.",
          409,
        );
      // Recheck after network awaits so concurrent clicks reserve one invoice only.
      const raced = db
        .prepare(
          "SELECT * FROM orders WHERE buyer=? AND game=? AND status IN ('created','prepared','pending','confirming')",
        )
        .get(req.account.id, game);
      if (raced) return res.json({ order: orderView(raced) });
      db.prepare(
        "INSERT INTO orders(id,buyer,game,vendor,price,quote,created_tip,created,expires) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        req.account.id,
        game,
        p.owner,
        info.total,
        JSON.stringify(quote),
        tip,
        now,
        now + 30 * 60000,
      );
      res.status(201).json({
        order: orderView(db.prepare("SELECT * FROM orders WHERE id=?").get(id)),
      });
    }),
  );
  app.post(
    "/api/orders/:id/prepare",
    vendor,
    wrap(async (req, res) => {
      let o = buyerOrder(req);
      if (o.prepared) return res.json({ order: orderView(o) });
      if (o.status !== "created" || o.expires < Date.now())
        throw fail("This quote expired. Cancel it and create a new order.");
      if (!fromGame(o.game).listed)
        throw fail(
          "This game is no longer accepting purchases. Cancel this unpaid quote.",
        );
      const tx = validatePaymentTransaction(req.body.transaction, o, {
        prepared: true,
      });
      const hash = tx.hash();
      if (
        db
          .prepare("SELECT id FROM orders WHERE tx_hash=? AND id<>?")
          .get(hash, o.id)
      )
        throw fail("This transaction is already reserved for another order.");
      db.prepare(
        "UPDATE orders SET tx_hash=?,prepared=?,status='prepared' WHERE id=?",
      ).run(hash, JSON.stringify(jsonSafe(tx)), o.id);
      res.json({ order: orderView(buyerOrder(req)) });
    }),
  );
  app.post(
    "/api/orders/:id/check",
    vendor,
    wrap(async (req, res) => {
      if (limited("order-check:" + req.account.id, 60, 60000))
        throw fail("Wait a moment before checking again.", 429);
      res.json({ order: orderView(await reconcile(buyerOrder(req))) });
    }),
  );
  app.post(
    "/api/orders/:id/cancel",
    vendor,
    wrap(async (req, res) => {
      const o = buyerOrder(req);
      if (o.tx_hash)
        throw fail(
          "A transaction is already reserved. Check its status instead of creating a second payment.",
        );
      db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(o.id);
      res.json({ order: orderView(buyerOrder(req)) });
    }),
  );
  app.post(
    "/api/games/:id/launch",
    needUser,
    wrap(async (req, res) => {
      const p = fromGame(req.params.id),
        d = JSON.parse(p.live),
        game = req.params.id;
      let grant = entitlement(req.account.id, game);
      if (grant?.order_id) {
        const order = await reconcile(
          db.prepare("SELECT * FROM orders WHERE id=?").get(grant.order_id),
        );
        if (order.status !== "confirmed")
          throw fail(
            "Payment is awaiting confirmation. Open your receipt to check it.",
            402,
          );
        grant = entitlement(req.account.id, game);
      }
      if (d.pricing === "paid" && !grant?.active)
        throw fail("Purchase this game with your wallet account first.", 402);
      if (!p.listed && !grant?.active)
        throw fail("This game is no longer listed.", 404);
      if (!p.key_hash)
        throw fail("The vendor needs to configure launch access.", 503);
      if (limited("launch:" + req.account.id, 30, 60000))
        throw fail("Please wait before launching again.", 429);
      if (!grant && d.pricing === "free")
        db.prepare(
          "INSERT OR IGNORE INTO entitlements(account,game,kind,created) VALUES(?,?,'free',?)",
        ).run(req.account.id, game, Date.now());
      const ticket = token();
      db.prepare("INSERT INTO launch_tickets VALUES(?,?,?,?)").run(
        digest(ticket),
        p.id,
        digest("utxoplay-vendor:" + p.id + ":" + req.account.id),
        Date.now() + 120000,
      );
      db.prepare(
        "INSERT INTO plays VALUES(?,?,?) ON CONFLICT(account,game) DO UPDATE SET updated=excluded.updated",
      ).run(req.account.id, game, Date.now());
      res.json({
        launchUrl: d.runtimeUrl + "/utxoplay/launch",
        ticket,
        expires: Date.now() + 120000,
        host: new URL(d.runtimeUrl).host,
      });
    }),
  );
  // This server-to-server endpoint uses a per-project key, never browser cookies.
  app.post(
    "/api/vendor/redeem",
    wrap(async (req, res) => {
      if (limited("redeem:" + req.ip, 180, 60000))
        throw fail("Too many launch requests.", 429);
      const key = req.headers.authorization?.replace(/^Bearer /, "");
      if (!key || !/^utxov_[0-9a-f]{64}$/.test(key))
        throw fail("Vendor key required.", 401);
      const p = db
        .prepare("SELECT project FROM listings WHERE key_hash=?")
        .get(digest(key));
      if (!p) throw fail("Invalid vendor key.", 401);
      if (
        typeof req.body.ticket !== "string" ||
        !/^[0-9a-f]{64}$/.test(req.body.ticket)
      )
        throw fail("Invalid launch ticket.", 401);
      const t = db
        .prepare(
          "DELETE FROM launch_tickets WHERE hash=? AND project=? AND expires>? RETURNING player,expires",
        )
        .get(digest(req.body.ticket), p.project, Date.now());
      if (!t)
        throw fail(
          "This launch ticket expired or was already used. Return to the store and launch again.",
          401,
        );
      res.json({
        player: t.player,
        projectId: p.project,
        expires: Date.now() + 86400000,
      });
    }),
  );
  let stopped = false,
    running = false;
  const timer = startWorker
    ? setInterval(async () => {
        if (running || stopped) return;
        running = true;
        try {
          for (const o of db
            .prepare(
              "SELECT * FROM orders WHERE tx_hash IS NOT NULL AND status IN ('prepared','pending','confirming') ORDER BY checked,created LIMIT 8",
            )
            .all()) {
            if (stopped) break;
            try {
              await reconcile(o);
            } catch {}
          }
          if (!stopped)
            db.prepare("DELETE FROM launch_tickets WHERE expires<?").run(
              Date.now(),
            );
        } finally {
          running = false;
        }
      }, 30000)
    : null;
  timer?.unref();
  return {
    catalog,
    library,
    close: () => {
      stopped = true;
      clearInterval(timer);
      void chain.close?.();
    },
    reconcile,
  };
}
