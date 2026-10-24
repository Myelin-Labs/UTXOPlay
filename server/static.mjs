import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
export function encodingQuality(header, encoding) {
  const values = new Map(
    String(header || "")
      .toLowerCase()
      .split(",")
      .map((part) => {
        const [name, ...args] = part.trim().split(";");
        const q = args.find((a) => a.trim().startsWith("q="));
        const quality = q ? Number(q.trim().slice(2)) : 1;
        return [
          name,
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
        ];
      }),
  );
  return values.get(encoding) ?? values.get("*") ?? 0;
}
export function assetCache(file) {
  if (/^stockfish-17\.1-lite-single-03e3232\.(?:js|wasm)$/.test(path.basename(file))) return "public, max-age=31536000, immutable";
  return /-[\w-]{8,}\.(?:js|css)(?:\.(?:br|gz))?$/.test(path.basename(file))
    ? "public, max-age=31536000, immutable"
    : /\.(?:png|webp|jpg|ico|mp3|woff2)(?:\.(?:br|gz))?$/.test(file)
      ? "public, max-age=3600"
      : "no-cache";
}
export function optimizedStatic(root, { index = "index.html" } = {}) {
  const absolute = path.resolve(root);
  const serve = express.static(absolute, {
    index,
    cacheControl: false,
    setHeaders(res, file) {
      res.setHeader("Cache-Control", assetCache(file));
    },
  });
  return (req, res, next) => {
    const original = req.url;
    let pathname;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    if (pathname.endsWith("/") && index) pathname += index;
    if (
      !["GET", "HEAD"].includes(req.method) ||
      !/\.(?:js|mjs|css|json|svg|html)$/.test(pathname)
    )
      return serve(req, res, next);
    res.vary("Accept-Encoding");
    const file = path.resolve(absolute, "." + pathname);
    if (!file.startsWith(absolute + path.sep) || req.headers.range)
      return serve(req, res, next);
    const candidates = [
      ["br", ".br"],
      ["gzip", ".gz"],
    ]
      .filter(([e]) => encodingQuality(req.headers["accept-encoding"], e) > 0)
      .sort(
        (a, b) =>
          encodingQuality(req.headers["accept-encoding"], b[0]) -
          encodingQuality(req.headers["accept-encoding"], a[0]),
      );
    const chosen = candidates.find(([, suffix]) => existsSync(file + suffix));
    if (!chosen) return serve(req, res, next);
    res.set("Content-Encoding", chosen[0]);
    res.type(path.extname(pathname));
    req.url = pathname.split("/").map(encodeURIComponent).join("/") + chosen[1];
    serve(req, res, (error) => {
      req.url = original;
      res.removeHeader("Content-Encoding");
      next(error);
    });
  };
}
