import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { ccc } from "@ckb-ccc/shell";
import { createApp } from "../server/index.mjs";
import {
  parsePrice,
  formatCkb,
  splitPrice,
  minimumPrice,
  validatePaymentTransaction,
  createChainReader,
  jsonSafe,
} from "../server/commerce.mjs";
import {
  publicHttps,
  isPublicIp,
  fetchVendorManifest,
} from "../server/vendor-network.mjs";
import { createVendorAdapter } from "../vendor/adapter.mjs";
const owner = ccc.ClientPublicMainnet.open(),
  client = owner.value;
const addr = async (b) =>
  new ccc.SignerCkbPrivateKey(
    client,
    "0x" + b.repeat(32),
  ).getRecommendedAddress();
const [seller, buyer, store, other] = await Promise.all(
  ["11", "22", "33", "44"].map(addr),
);
const origin = "https://store.utxoplay.io",
  dir = mkdtempSync(path.join(tmpdir(), "utxoplay-commerce-"));
let health = true,
  chainStatus = "pending",
  confirmations = 0;
const chain = {
  address: (a) => ccc.Address.fromString(a, client),
  tip: async () => "99",
  inspect: async () => ({ status: chainStatus, confirmations }),
  close() {},
};
const service = createApp({
  dataDir: dir,
  origin,
  verify: async (_m, _p, address) => ({
    id: createHash("sha256").update(address).digest("hex"),
    address,
    scheme: "CkbSecp256k1",
  }),
  marketplaceOptions: {
    chain,
    storeAddress: store,
    startWorker: false,
    manifestFetch: async () => {
      if (!health) throw Error("Instance is unavailable.");
      const row = service.db
        .prepare(
          "SELECT p.id,l.* FROM projects p JOIN listings l ON p.id=l.project ORDER BY p.created DESC LIMIT 1",
        )
        .get();
      const d = JSON.parse(row.draft);
      return {
        protocol: "utxoplay.vendor.v1",
        projectId: row.id,
        verificationToken: row.verification,
        keyFingerprint: row.key_hash,
        runtime: { name: "myelin", version: "1.0.0" },
        status: "ready",
        gameUrl: d.gameUrl,
        launchUrl: d.runtimeUrl + "/utxoplay/launch",
      };
    },
  },
});
const server = service.app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
async function req(url, body, cookie = "", headers = {}) {
  const r = await fetch(base + url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; "),
  };
}
async function login(address) {
  const c = await req("/api/auth/challenge", { address });
  const r = await req(
    "/api/auth/verify",
    { id: c.data.id, proof: {} },
    c.cookie,
  );
  assert.equal(r.status, 200);
  return r.cookie;
}
const sellerCookie = await login(seller),
  buyerCookie = await login(buyer),
  otherCookie = await login(other);
let project, key, game, order;
after(async () => {
  await new Promise((r) => server.close(r));
  service.close();
  await owner.dispose();
  rmSync(dir, { recursive: true, force: true });
});
test("integer CKB pricing and direct split preserve every shannon and enforce minimum outputs", async () => {
  assert.equal(parsePrice("305.00000001"), 30500000001n);
  assert.deepEqual(splitPrice(30500000001n), {
    total: "30500000001",
    store: "6100000000",
    vendor: "24400000001",
  });
  assert.equal(formatCkb(30500000001n), "305.00000001");
  for (const v of ["0", "-1", "NaN", "1e3", "0.000000001", "1000001", "01"])
    assert.throws(() => parsePrice(v));
  const s = await chain.address(store),
    v = await chain.address(seller);
  assert.equal(minimumPrice(s.script, v.script), 30500000000n);
});
test("vendor URL checks reject local, special-use and ambiguous targets and pin public DNS", async () => {
  for (const value of [
    "http://example.com",
    "https://127.0.0.1",
    "https://169.254.169.254",
    "https://[::1]",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "https://example.com/?secret=x",
    "https://localhost",
    "https://2130706433",
  ])
    assert.throws(() => publicHttps(value));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
    "0.0.0.0",
  ])
    assert.equal(isPublicIp(ip), false, ip);
  assert.equal(isPublicIp("8.8.8.8"), true);
  let called = false;
  await assert.rejects(
    fetchVendorManifest("https://example.com", {
      resolve: async () => [{ address: "127.0.0.1", family: 4 }],
      request: () => {
        called = true;
      },
    }),
    /public IP/,
  );
  assert.equal(called, false);
});
test("wallet vendor creates a default-free draft, checks configuration and publishes without payment", async () => {
  const r = await req(
    "/api/developer/projects",
    {
      title: "Test Garden",
      description: "A test game",
      gameUrl: "https://games.example.com/game",
      runtimeUrl: "https://games.example.com",
      controls: "Drag to play.",
      developerName: "Original Studio",
      developerAddress: "",
      publisherName: "Garden Publishing",
      payoutAddress: other,
    },
    sellerCookie,
  );
  assert.equal(r.status, 201);
  project = r.data;
  game = "vendor-" + project.id;
  assert.equal(project.draft.pricing, "free");
  assert.deepEqual(project.developer, { name: "Original Studio", address: null });
  assert.deepEqual(project.publisher, { name: "Garden Publishing", address: seller });
  assert.notEqual(project.publisher.address, project.draft.payoutAddress);
  assert.equal(
    (
      await req(
        `/api/developer/projects/${project.id}/publish`,
        { revision: project.revision },
        sellerCookie,
      )
    ).status,
    400,
  );
  const k = await req(
    `/api/developer/projects/${project.id}/key`,
    {},
    sellerCookie,
  );
  key = k.data.key;
  assert.match(key, /^utxov_/);
  assert.equal(
    (await req(`/api/developer/projects/${project.id}/check`, {}, sellerCookie))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        `/api/developer/projects/${project.id}/publish`,
        { revision: project.revision },
        otherCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await req(
        `/api/developer/projects/${project.id}/publish`,
        { revision: project.revision },
        sellerCookie,
      )
    ).status,
    200,
  );
  const published = (await req("/api/games")).data.games.find((g) => g.id === game);
  assert.deepEqual(published.developer, project.developer);
  assert.deepEqual(published.publisher, project.publisher);
  assert.equal(service.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
});
test("credits separate original authorship, publishing authority and payout, and reject forged wallets", async () => {
  let p = (await req("/api/developer/projects", undefined, sellerCookie)).data.projects[0];
  for (const draft of [
    { publisherAddress: other }, { publisher: { name: "Imposter", address: other } },
    { owner: "forged" }, { developer: { name: "Forged", address: other } },
    { developerAddress: "ckb1invalid" }, { developerAddress: "ckt1wrongnetwork" },
    { developerName: "Hidden\u202ename" }, { publisherName: "x".repeat(81) },
    { developerName: "", developerAddress: other },
    { developerSourceUrl: "javascript:alert(1)" }, { developerSourceUrl: "https://127.0.0.1/source" },
  ]) {
    const rejected = await req(`/api/developer/projects/${p.id}/save`, { revision: p.revision, draft }, sellerCookie);
    assert.equal(rejected.status, 400, JSON.stringify(draft));
  }
  assert.equal((await req(`/api/developer/projects/${p.id}/save`, { revision: p.revision, draft: { publisherName: "Hijacked" } }, otherCookie)).status, 404);
  const saved = await req(`/api/developer/projects/${p.id}/save`, { revision: p.revision, draft: { developerAddress: other, publisherName: "Next Publishing", developerSourceUrl: "https://github.com/example/original" } }, sellerCookie);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data.developer, { name: "Original Studio", address: other, sourceUrl: "https://github.com/example/original" });
  assert.deepEqual(saved.data.liveCredits.publisher, { name: "Garden Publishing", address: seller });
  assert.equal(saved.data.liveCredits.developer.sourceUrl, undefined);
  assert.deepEqual(saved.data.publisher, { name: "Next Publishing", address: seller });
  const live = (await req("/api/games")).data.games.find(g => g.id === game);
  assert.deepEqual(live.developer, { name: "Original Studio", address: null });
  assert.deepEqual(live.publisher, { name: "Garden Publishing", address: seller });
  p = saved.data;
  const restored = await req(`/api/developer/projects/${p.id}/save`, { revision: p.revision, draft: { developerAddress: "", publisherName: "Garden Publishing", developerSourceUrl: "" } }, sellerCookie);
  assert.equal(restored.status, 200);
  assert.equal(restored.data.developer.address, null);
});
test("developer wallet validation cannot overwrite a concurrent newer draft", async () => {
  let p = (await req("/api/developer/projects", undefined, sellerCookie)).data.projects[0];
  const original = chain.address;
  let enter, release;
  const entered = new Promise(r => enter = r), gate = new Promise(r => release = r);
  chain.address = async a => { enter(); await gate; return original(a); };
  const slow = req(`/api/developer/projects/${p.id}/save`, { revision: p.revision, draft: { developerAddress: other } }, sellerCookie);
  try {
    await entered;
    const newer = await req(`/api/developer/projects/${p.id}/save`, { revision: p.revision, draft: { publisherName: "Garden Publishing" } }, sellerCookie);
    assert.equal(newer.status, 200);
    release();
    assert.equal((await slow).status, 409);
    const current = (await req("/api/developer/projects", undefined, sellerCookie)).data.projects[0];
    assert.equal(current.revision, newer.data.revision);
    assert.equal(current.developer.address, null);
  } finally { release(); chain.address = original; await slow; }
});
test("launch grants are scoped to one project, expire, and redeem once without exposing wallet identity", async () => {
  const guest = await req("/api/guest", {});
  const launch = await req(`/api/games/${game}/launch`, {}, guest.cookie);
  assert.equal(launch.status, 200);
  assert.equal(
    launch.data.launchUrl,
    "https://games.example.com/utxoplay/launch",
  );
  assert.equal(
    (
      await req("/api/vendor/redeem", { ticket: launch.data.ticket }, "", {
        Origin: "",
        Authorization: "Bearer utxov_" + "0".repeat(64),
      })
    ).status,
    401,
  );
  const redeemed = await req(
    "/api/vendor/redeem",
    { ticket: launch.data.ticket },
    "",
    { Origin: "", Authorization: "Bearer " + key },
  );
  assert.equal(redeemed.status, 200);
  assert.match(redeemed.data.player, /^[a-f0-9]{64}$/);
  assert.equal(redeemed.data.address, undefined);
  assert.equal(
    (
      await req("/api/vendor/redeem", { ticket: launch.data.ticket }, "", {
        Authorization: "Bearer " + key,
      })
    ).status,
    401,
  );
  const again = await req(`/api/games/${game}/launch`, {}, guest.cookie);
  service.db.prepare("UPDATE launch_tickets SET expires=0").run();
  assert.equal(
    (
      await req("/api/vendor/redeem", { ticket: again.data.ticket }, "", {
        Authorization: "Bearer " + key,
      })
    ).status,
    401,
  );
  assert.equal(
    (await req("/api/library", undefined, guest.cookie)).data.games.find(
      (g) => g.game === game,
    ).owned,
    true,
  );
});
test("draft edits do not alter live games; stale edits fail; paid publication validates minimum capacity", async () => {
  let p = (await req("/api/developer/projects", undefined, sellerCookie)).data
    .projects[0];
  const saved = await req(
    `/api/developer/projects/${p.id}/save`,
    {
      revision: p.revision,
      draft: {
        pricing: "paid",
        priceCkb: "1",
        payoutAddress: seller,
        supportUrl: "https://games.example.com/support",
        refundUrl: "https://games.example.com/refunds",
      },
    },
    sellerCookie,
  );
  assert.equal(saved.status, 200);
  assert.equal(
    (
      await req(
        `/api/developer/projects/${p.id}/save`,
        { revision: p.revision, draft: { title: "Stale edit" } },
        sellerCookie,
      )
    ).status,
    409,
  );
  p = saved.data;
  assert.equal(
    (await req("/api/games")).data.games.find((g) => g.id === game).pricing,
    "free",
  );
  assert.match(
    (
      await req(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        sellerCookie,
      )
    ).data.error,
    /at least 305/,
  );
  p = (
    await req(
      `/api/developer/projects/${p.id}/save`,
      { revision: p.revision, draft: { priceCkb: "400" } },
      sellerCookie,
    )
  ).data;
  health = false;
  assert.equal(
    (
      await req(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        sellerCookie,
      )
    ).status,
    400,
  );
  health = true;
  assert.equal(
    (
      await req(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        sellerCookie,
      )
    ).status,
    200,
  );
  project = p;
});
test("checkout reserves one quote per buyer; inputs and exact split are bound before signing", async () => {
  const r = await req("/api/orders", { game }, buyerCookie);
  assert.equal(r.status, 201);
  order = r.data.order;
  assert.equal(order.priceCkb, "400");
  assert.deepEqual(order.credits, {developer:{name:"Original Studio",address:null},publisher:{name:"Garden Publishing",address:seller}});
  assert.equal(order.store, "8000000000");
  assert.equal(order.vendor, "32000000000");
  assert.equal(
    (await req("/api/orders", { game }, buyerCookie)).data.order.id,
    order.id,
  );
  assert.equal(
    (await req(`/api/orders/${order.id}/check`, {}, otherCookie)).status,
    404,
  );
  const tx = ccc.Transaction.from({
    inputs: [
      {
        previousOutput: { txHash: "0x" + "ab".repeat(32), index: 0 },
        since: 0,
      },
    ],
    outputs: order.outputs,
    outputsData: ["0x", "0x"],
  });
  const bad = tx.clone();
  bad.outputs[0].capacity++;
  assert.equal(
    (
      await req(
        `/api/orders/${order.id}/prepare`,
        { transaction: jsonSafe(bad) },
        buyerCookie,
      )
    ).status,
    400,
  );
  const prepared = await req(
    `/api/orders/${order.id}/prepare`,
    { transaction: jsonSafe(tx) },
    buyerCookie,
  );
  assert.equal(prepared.status, 200);
  assert.equal(prepared.data.order.txHash, tx.hash());
  order = prepared.data.order;
  assert.equal(
    (await req(`/api/orders/${order.id}/cancel`, {}, buyerCookie)).status,
    400,
  );
  assert.equal(
    (await req(`/api/games/${game}/launch`, {}, buyerCookie)).status,
    402,
  );
});
test("confirmations unlock once, survive repeated checks, pay both shares and reorg suspends launch", async () => {
  chainStatus = "confirming";
  confirmations = 23;
  assert.equal(
    (await req(`/api/orders/${order.id}/check`, {}, buyerCookie)).data.order
      .status,
    "confirming",
  );
  assert.equal(
    (await req(`/api/games/${game}/launch`, {}, buyerCookie)).status,
    402,
  );
  chainStatus = "confirmed";
  confirmations = 24;
  await req(`/api/orders/${order.id}/check`, {}, buyerCookie);
  await req(`/api/orders/${order.id}/check`, {}, buyerCookie);
  assert.equal(
    service.db
      .prepare("SELECT count(*) n FROM entitlements WHERE kind='paid'")
      .get().n,
    1,
  );
  assert.equal(
    (await req(`/api/games/${game}/launch`, {}, buyerCookie)).status,
    200,
  );
  assert.equal(
    (await req("/api/developer/sales", undefined, sellerCookie)).data.vendorCkb,
    "320",
  );
  chainStatus = "pending";
  confirmations = 0;
  assert.equal(
    (await req(`/api/games/${game}/launch`, {}, buyerCookie)).status,
    402,
  );
  assert.equal(
    (await req("/api/developer/sales", undefined, sellerCookie)).data.vendorCkb,
    "0",
  );
  chainStatus = "confirmed";
  confirmations = 24;
  await req(`/api/orders/${order.id}/check`, {}, buyerCookie);
});
test("unlisting stops new sales but preserves owners, receipts and free grants", async () => {
  await req(
    `/api/developer/projects/${project.id}/unpublish`,
    {},
    sellerCookie,
  );
  assert.equal(
    (await req("/api/games")).data.games.some((g) => g.id === game),
    false,
  );
  assert.equal((await req("/api/orders", { game }, otherCookie)).status, 400);
  assert.equal(
    (await req(`/api/games/${game}/launch`, {}, buyerCookie)).status,
    200,
  );
  assert.equal(
    (await req("/api/orders", undefined, buyerCookie)).data.orders[0]
      .vendorAddress,
    seller,
  );
  assert.equal((await req("/api/games/" + game)).status, 404);
  assert.equal(
    (await req("/api/games/" + game, undefined, buyerCookie)).status,
    200,
  );
});
test("chain verifier checks canonical block, exact outputs, buyer funding and required confirmations", async () => {
  const row = service.db
      .prepare("SELECT * FROM orders WHERE id=?")
      .get(order.id),
    tx = ccc.Transaction.from(JSON.parse(row.prepared));
  const quote = JSON.parse(row.quote),
    hash = "0x" + "bb".repeat(32);
  let canonical = hash,
    height = 123n,
    inputLock = quote.buyerLock;
  const mock = {
    getTransactionNoCache: async (h) =>
      h === row.tx_hash
        ? {
            transaction: tx,
            status: "committed",
            blockNumber: 100n,
            blockHash: hash,
          }
        : {
            transaction: ccc.Transaction.from({
              outputs: [{ capacity: "100000000000", lock: inputLock }],
              outputsData: ["0x"],
            }),
          },
    getHeaderByNumberNoCache: async () => ({ hash: canonical }),
    getTipHeader: async () => ({ number: height }),
  };
  const reader = createChainReader({ client: mock });
  assert.equal((await reader.inspect(row)).status, "confirmed");
  height = 122n;
  assert.equal((await reader.inspect(row)).status, "confirming");
  height = 123n;
  canonical = "0x" + "cc".repeat(32);
  assert.equal((await reader.inspect(row)).status, "pending");
  canonical = hash;
  inputLock = (await chain.address(other)).script;
  await assert.rejects(reader.inspect(row), /purchasing wallet/);
  await assert.rejects(
    reader.inspect({ ...row, created_tip: "100" }),
    /predates/,
  );
  const tampered = tx.clone();
  tampered.outputs[1].capacity++;
  assert.throws(() => validatePaymentTransaction(tampered, row), /exact/);
});
test("vendor adapter enforces launch origin, exchanges the key server-side and scopes runtime identity", async () => {
  const web = mkdtempSync(path.join(tmpdir(), "utxoplay-vendor-web-"));
  writeFileSync(path.join(web, "index.html"), "Game test");
  let captured;
  const adapter = createVendorAdapter({
    storeOrigin: origin,
    projectId: "a".repeat(24),
    verificationToken: "v".repeat(64),
    vendorKey: "utxov_" + "1".repeat(64),
    publicOrigin: "https://games.example.com",
    gameUrl: "https://games.example.com/game",
    runtimeUrl: "http://127.0.0.1:9001",
    runtimeToken: "runtime".repeat(8),
    myelinVersion: "1.0.0",
    sessionSecret: "secret".repeat(8),
    webRoot: web,
    secureCookies: false,
    fetchImpl: async (url, opt) => {
      captured = { url, opt };
      if (url.endsWith("/api/vendor/redeem"))
        return Response.json({
          player: "a".repeat(64),
          projectId: "a".repeat(24),
          expires: Date.now() + 60000,
        });
      return Response.json({ session: { id: "runtime-session" } });
    },
  });
  const s = adapter.app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const b = "http://127.0.0.1:" + s.address().port;
  try {
    assert.equal((await fetch(b + "/api/state")).status, 401);
    const m = await (await fetch(b + "/.well-known/utxoplay.json")).json();
    assert.equal(m.status, "ready");
    assert.equal(m.keyFingerprint.length, 64);
    assert.equal(
      (
        await fetch(b + "/utxoplay/launch", {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "ticket=" + "1".repeat(64),
          redirect: "manual",
        })
      ).status,
      403,
    );
    const launch = await fetch(b + "/utxoplay/launch", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "ticket=" + "1".repeat(64),
      redirect: "manual",
    });
    assert.equal(launch.status, 303);
    const cookie = launch.headers.getSetCookie()[0].split(";")[0];
    assert.equal(
      captured.opt.headers.Authorization,
      "Bearer utxov_" + "1".repeat(64),
    );
    assert.equal(
      (
        await fetch(b + "/api/state", {
          headers: { Cookie: cookie, "X-UTXOPlay-Account": "b".repeat(64) },
        })
      ).status,
      200,
    );
    assert.equal(captured.opt.headers["X-UTXOPlay-Account"], "a".repeat(64));
    assert.equal(
      (
        await fetch(b + "/api/action", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
  } finally {
    adapter.close();
    await new Promise((r) => s.close(r));
    rmSync(web, { recursive: true, force: true });
  }
});

test("concurrent buyers reuse one quote; later prices do not alter it; unlisting blocks preparation", async () => {
  let p = (await req("/api/developer/projects", undefined, sellerCookie)).data
    .projects[0];
  assert.equal(
    (
      await req(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        sellerCookie,
      )
    ).status,
    200,
  );
  const purchases = await Promise.all([
    req("/api/orders", { game }, otherCookie),
    req("/api/orders", { game }, otherCookie),
  ]);
  assert.equal(purchases[0].data.order.id, purchases[1].data.order.id);
  const reserved = purchases[0].data.order;
  p = (
    await req(
      `/api/developer/projects/${p.id}/save`,
      { revision: p.revision, draft: { priceCkb: "800", publisherName: "Renamed Publisher", developerName: "Updated Studio" } },
      sellerCookie,
    )
  ).data;
  assert.equal(
    (
      await req(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        sellerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("/api/orders", { game }, otherCookie)).data.order.priceCkb,
    "400",
  );
  const retained = (await req("/api/orders", { game }, otherCookie)).data.order;
  assert.deepEqual(retained.credits, reserved.credits);
  const live = (await req("/api/games")).data.games.find(g=>g.id===game);
  assert.equal(live.publisher.name, "Renamed Publisher");
  assert.notEqual(retained.credits.publisher.name, live.publisher.name);
  assert.equal(retained.credits.publisher.address, seller);
  await req(`/api/developer/projects/${p.id}/unpublish`, {}, sellerCookie);
  const tx = ccc.Transaction.from({
    inputs: [
      {
        previousOutput: { txHash: "0x" + "cd".repeat(32), index: 0 },
        since: 0,
      },
    ],
    outputs: reserved.outputs,
    outputsData: ["0x", "0x"],
  });
  assert.match(
    (
      await req(
        `/api/orders/${reserved.id}/prepare`,
        { transaction: jsonSafe(tx) },
        otherCookie,
      )
    ).data.error,
    /no longer accepting/,
  );
  assert.equal(
    (await req(`/api/orders/${reserved.id}/cancel`, {}, otherCookie)).data.order
      .status,
    "cancelled",
  );
});

test("an unlist during an awaited chain quote prevents creating a new sale", async () => {
  const p = (await req("/api/developer/projects", undefined, sellerCookie)).data
    .projects[0];
  assert.equal(
    (
      await req(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        sellerCookie,
      )
    ).status,
    200,
  );
  const originalTip = chain.tip;
  chain.tip = async () => {
    service.db
      .prepare("UPDATE listings SET listed=0 WHERE project=?")
      .run(p.id);
    return "100";
  };
  try {
    assert.equal((await req("/api/orders", { game }, otherCookie)).status, 409);
  } finally {
    chain.tip = originalTip;
  }
});

test("missing Store receive address permits free publishing and blocks paid activation without requesting funds", async () => {
  const temp = mkdtempSync(path.join(tmpdir(), "utxoplay-unconfigured-"));
  let fresh;
  fresh = createApp({
    dataDir: temp,
    origin,
    marketplaceOptions: {
      storeAddress: "",
      chain,
      startWorker: false,
      manifestFetch: async () => {
        const p = fresh.db.prepare("SELECT * FROM listings").get(),
          d = JSON.parse(p.draft);
        return {
          protocol: "utxoplay.vendor.v1",
          projectId: p.project,
          verificationToken: p.verification,
          keyFingerprint: p.key_hash,
          runtime: { name: "myelin", version: "1" },
          status: "ready",
          gameUrl: d.gameUrl,
          launchUrl: d.runtimeUrl + "/utxoplay/launch",
        };
      },
    },
  });
  const a = service.db
    .prepare("SELECT * FROM accounts WHERE address=?")
    .get(seller);
  fresh.db
    .prepare("INSERT INTO accounts VALUES(?,?,?,?)")
    .run(a.id, a.address, a.scheme, a.created);
  fresh.db
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(
      createHash("sha256").update("fixture-session").digest("hex"),
      a.id,
      Date.now() + 60000,
    );
  const srv = fresh.app.listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const api = async (url, body) => {
    const r = await fetch("http://127.0.0.1:" + srv.address().port + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        Cookie: "utxoplay_session=fixture-session",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    assert.equal((await api("/api/commerce/config")).data.configured, false);
    let p = (
      await api("/api/developer/projects", {
        title: "Free without settlement",
        description: "Test",
        controls: "Click",
        gameUrl: "https://free.example.com/game",
        runtimeUrl: "https://free.example.com",
      })
    ).data;
    const unnamed = await api(`/api/developer/projects/${p.id}/publish`, {revision:p.revision});
    assert.equal(unnamed.status,400);assert.match(unnamed.data.error,/developer and publisher names/);
    p = (await api(`/api/developer/projects/${p.id}/save`, {revision:p.revision,draft:{developerName:"Free Studio",publisherName:"Free Publisher"}})).data;
    await api(`/api/developer/projects/${p.id}/key`, {});
    assert.equal(
      (
        await api(`/api/developer/projects/${p.id}/publish`, {
          revision: p.revision,
        })
      ).status,
      200,
    );
    p = (
      await api(`/api/developer/projects/${p.id}/save`, {
        revision: p.revision,
        draft: {
          pricing: "paid",
          priceCkb: "400",
          payoutAddress: seller,
          supportUrl: "https://free.example.com/support",
          refundUrl: "https://free.example.com/refunds",
        },
      })
    ).data;
    assert.equal(
      (
        await api(`/api/developer/projects/${p.id}/publish`, {
          revision: p.revision,
        })
      ).status,
      503,
    );
    assert.equal(
      (await api("/api/games")).data.games.find(
        (g) => g.id === "vendor-" + p.id,
      ).pricing,
      "free",
    );
    assert.equal(fresh.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
  } finally {
    await new Promise((r) => srv.close(r));
    fresh.close();
    rmSync(temp, { recursive: true, force: true });
  }
});

test("older receipts without credits are not backfilled from a later listing",async()=>{
 const row=service.db.prepare("SELECT id,quote FROM orders WHERE id=?").get(order.id);
 const quote=JSON.parse(row.quote);delete quote.game.developer;delete quote.game.publisher;
 try {
  service.db.prepare("UPDATE orders SET quote=? WHERE id=?").run(JSON.stringify(quote),row.id);
  const receipt=(await req('/api/orders',undefined,buyerCookie)).data.orders.find(o=>o.id===row.id);
  assert.equal(receipt.credits,null);assert.equal(receipt.vendorAddress,order.vendorAddress);
 } finally {service.db.prepare("UPDATE orders SET quote=? WHERE id=?").run(row.quote,row.id);}
});
