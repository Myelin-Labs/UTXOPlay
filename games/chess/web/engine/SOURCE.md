# Stockfish.js 17.1 Lite — source and license

This directory redistributes the unmodified single-threaded Lite engine from
`stockfish@17.1.0`, by Nathan Rugg, Chess.com and the Stockfish contributors,
under GNU GPL version 3. See `Copying.txt` and `AUTHORS`. It comes without warranty.

- Upstream: https://github.com/nmrugg/stockfish.js
- Exact npm source commit: `602fd7e1a571a2be71f242942db90483731f2a1f`
- Original package: https://registry.npmjs.org/stockfish/-/stockfish-17.1.0.tgz
- Corresponding source download: [stockfish-17.1-lite-source.tar.gz](./stockfish-17.1-lite-source.tar.gz)

The source archive retains the upstream C++ sources, JavaScript glue, build
scripts, license and authors, and includes the required `nn-9067e33176e8.nnue`
network. Its SHA-256 starts with `9067e33176e8`. Precompiled artifacts and unused
full-strength networks are omitted. No engine source is modified.

To build the shipped flavor, install Emscripten 3.1.7, Node.js, make, Python and
C++ build prerequisites, extract the archive, enter its root and run:

```
node build.js --lite --single-threaded
```

See the included README, build.js --help and src/Makefile for the complete
upstream toolchain and options. This app speaks UCI text commands to the engine
in a separate browser worker. One worker, 16 MiB hash table and bounded move times
are used; no shared-memory or cross-origin isolation is required. Stockfish
chooses candidate moves only. The native Myelin Chess runtime validates and
records every accepted move.
