// Rebuild web delivery images from the preserved ImageGen PNGs.
// ART_TOOL_MODULES=/path/to/node_modules node tools/build-premium-art.mjs
// Requires optional @napi-rs/canvas, not a production/runtime dependency.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
import {packs} from '../games/arcade/web/premium-art.mjs';
const require=createRequire(process.env.ART_TOOL_MODULES?resolve(process.env.ART_TOOL_MODULES,'../package.json'):import.meta.url),{loadImage,createCanvas}=require('@napi-rs/canvas');
const out='games/arcade/web/art';mkdirSync(out,{recursive:true});
for(const {prefix,rects}of Object.values(packs))for(const type of ['bg','atlas']){
 const img=await loadImage(`assets/arcade-premium-source/${prefix}_${type}.png`),canvas=createCanvas(img.width,img.height);canvas.getContext('2d').drawImage(img,0,0);writeFileSync(`${out}/${prefix}_${type}.webp`,canvas.toBuffer('image/webp',type==='bg'?88:94));
 if(prefix==='prism'&&type==='atlas')for(const name of ['paddle','diamond','citrine','aquamarine','amethyst','heart','lens']){const[x,y,w,h]=rects[name],s=Math.min(1,240/Math.max(w,h)),icon=createCanvas(Math.ceil(w*s),Math.ceil(h*s));icon.getContext('2d').drawImage(img,x,y,w,h,0,0,icon.width,icon.height);writeFileSync(`${out}/prism-${name}.webp`,icon.toBuffer('image/webp',94));}
}
