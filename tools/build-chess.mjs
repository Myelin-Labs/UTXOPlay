import { build } from "esbuild";
for (const name of ["strategy", "worker"])
  await build({
    entryPoints: [`games/chess/client/${name}.mjs`],
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2022",
    outfile: `games/chess/web/${name}.js`,
    legalComments: "eof",
  });
