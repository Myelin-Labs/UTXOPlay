import https from "node:https";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export function publicHttps(value, { optional = false } = {}) {
  if (optional && !value) return "";
  if (typeof value !== "string" || value.length > 500)
    throw Error("Provide a public HTTPS address.");
  let u;
  try {
    u = new URL(value);
  } catch {
    throw Error("Use a complete HTTPS address.");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    u.search ||
    (u.port && u.port !== "443")
  )
    throw Error(
      "Use HTTPS on port 443, without credentials, query parameters or fragments.",
    );
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (
    !host.includes(".") ||
    /\.(localhost|local|internal|test|invalid)$/i.test(host) ||
    host === "localhost" ||
    (ipaddr.isValid(host) && !isPublicIp(host))
  )
    throw Error("The instance must use a public internet address.");
  return u.href.replace(/\/$/, "");
}
export function isPublicIp(value) {
  try {
    const ip = ipaddr.process(value);
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export async function fetchVendorManifest(
  base,
  { resolve = lookup, request = https.request } = {},
) {
  const target = new URL(publicHttps(base) + "/.well-known/utxoplay.json");
  const records = await Promise.race([
    resolve(target.hostname, { all: true }),
    new Promise((_, reject) => {
      const t = setTimeout(() => reject(Error("DNS lookup timed out.")), 5000);
      t.unref();
    }),
  ]);
  if (!records.length || records.some((r) => !isPublicIp(r.address)))
    throw Error("Instance DNS must resolve only to public IP addresses.");
  const pinned = records[0];
  return new Promise((resolve, reject) => {
    const req = request(
      target,
      {
        method: "GET",
        agent: false,
        headers: {
          Accept: "application/json",
          "User-Agent": "UTXOPlay-Vendor-Check/1.0",
        },
        lookup: (_host, options, cb) =>
          options.all
            ? cb(null, [pinned])
            : cb(null, pinned.address, pinned.family),
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            Error(
              "The instance must return HTTP 200 directly; redirects are not followed.",
            ),
          );
          return;
        }
        if (!/^application\/json\b/i.test(res.headers["content-type"] || "")) {
          res.resume();
          reject(Error("The instance manifest must return application/json."));
          return;
        }
        let length = 0,
          chunks = [];
        res.on("data", (chunk) => {
          length += chunk.length;
          if (length > 16384) {
            req.destroy(Error("Instance manifest is too large."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch {
            reject(Error("Instance manifest is not valid JSON."));
          }
        });
        res.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(Error("Instance check timed out.")),
      7000,
    );
    deadline.unref();
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
    req.end();
  });
}
