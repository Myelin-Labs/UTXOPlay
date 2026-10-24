import {build} from 'esbuild';
await build({entryPoints:['games/openstrike/client/main.mjs'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'games/openstrike/web/app.js',legalComments:'eof'});
