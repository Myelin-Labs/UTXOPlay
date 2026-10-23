// DOM integration tests against the actual Rust server; not a visual-browser test.
import { Window } from "happy-dom";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const bin = process.argv[2] || path.join(root, "target/debug", pkg.name);
const temp = await mkdtemp(path.join(tmpdir(), pkg.name + "-ui-"));
const reservation = createServer();
await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
const port = reservation.address().port;
await new Promise((r) => reservation.close(r));
const base = `http://127.0.0.1:${port}`;
const server = spawn(bin, [], {
  env: { ...process.env, PORT: String(port), DATA_DIR: temp },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (await predicate()) return;
    await delay(40);
  }
  throw Error("Condition timed out: " + logs);
}
let win;
try {
  await until(async () => {
    try {
      return (await fetch(base + "/api/state")).ok;
    } catch {
      return false;
    }
  });
  win = new Window({
    url: base,
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  win.document.write(await readFile(path.join(root, "web/index.html"), "utf8"));
  win.fetch = (url, options) => fetch(new URL(url, base), options);
  win.toggleSound = async () => true;
  win.volume = () => {};
  win.sound = () => {};
  win.setInterval = () => 0;
  let frame;
  win.requestAnimationFrame = (fn) => {
    frame = fn;
    return 1;
  };
  win.HTMLCanvasElement.prototype.getContext = () =>
    new Proxy({}, { get: () => () => {}, set: () => true });
  const source = (
    await readFile(path.join(root, "web/app.js"), "utf8")
  ).replace(/^import[^\n]+\n/, "");
  await win.eval(`(async()=>{${source}\n})()`);
  const $ = (s) => win.document.querySelector(s);
  if (pkg.name === "myelin-chess") {
    assert.equal(win.document.querySelectorAll(".square").length, 64);
    assert.equal(win.document.querySelectorAll(".piece").length, 32);
    $('[data-square="e2"]').click();
    assert.equal(win.document.querySelectorAll(".legal").length, 2);
    $('[data-square="e4"]').click();
    await until(() => $("#status").textContent.includes("Black to move"));
    assert.match($("#moves").textContent, /e2e4/);
    $("#flip").click();
    assert.equal($("#board").firstElementChild.dataset.square, "h1");
    $("#replay").click();
    await until(() =>
      $("#verification").textContent.includes("1 signed frames"),
    );
    await until(() => !$("#replay").disabled);
    $("#credits-open").click();
    assert.equal($("#credits").open, true);
    $("#credits-close").click();
    assert.equal($("#credits").open, false);
  } else {
    $("#angle").value = "8";
    $("#power").value = "99";
    $("#launch").click();
    await until(
      async () =>
        (await (await fetch(base + "/api/state")).json()).session.actions === 1,
    );
    await delay(50);
    frame?.(win.performance.now() + 10000);
    const state = await (await fetch(base + "/api/state")).json();
    assert.equal(state.game.shots, 3);
    assert.equal(state.game.world_trace.length, state.game.trace.length);
    $("#verify").click();
    await until(() => $("#verification").textContent.includes("1 frames"));
    $("#credits-open").click();
    assert.equal($("#credits").open, true);
    $("#credits-close").click();
  }
  assert.equal((await fetch(base + "/api/state")).status, 200);
  console.log(
    pkg.name + ": DOM controls, gameplay submission, replay and credits passed",
  );
} finally {
  await win?.happyDOM.abort();
  server.kill("SIGTERM");
  await new Promise((r) => server.once("exit", r));
  await rm(temp, { recursive: true, force: true });
}
