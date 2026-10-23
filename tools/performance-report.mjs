import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json"));
const visited = new Set();
function collect(key) {
  if (visited.has(key)) return;
  visited.add(key);
  for (const k of manifest[key]?.imports || []) collect(k);
}
collect("index.html");
const files = [...visited].map((k) => manifest[k].file);
console.log(
  JSON.stringify(
    {
      initialJavaScript: files,
      initialBytes: files.reduce((s, f) => s + statSync("dist/" + f).size, 0),
      initialGzipBytes: files.reduce(
        (s, f) => s + gzipSync(readFileSync("dist/" + f)).length,
        0,
      ),
    },
    null,
    2,
  ),
);
