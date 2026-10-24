// Optional build dependency; no image processing runs in production.
// ART_TOOL_MODULES=/path/to/node_modules node tools/build-atelier-art.mjs
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
const require=createRequire(process.env.ART_TOOL_MODULES?resolve(process.env.ART_TOOL_MODULES,'../package.json'):import.meta.url),{loadImage,createCanvas}=require('@napi-rs/canvas');
const packs={};for(const[kind,prefix]of Object.entries({'rune-foundry':'foundry','lumen-weave':'weave','orbit-courier':'orbit',mosslight:'moss'})){
 for(const type of ['bg','atlas']){const im=await loadImage(`assets/atelier-source/${prefix}_${type}.png`),c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);mkdirSync('games/atelier/web/art',{recursive:true});writeFileSync(`games/atelier/web/art/${prefix}_${type}.webp`,c.toBuffer('image/webp',type==='bg'?88:94));
 if(type==='bg')copyFileSync(`games/atelier/web/art/${prefix}_bg.webp`,`public/assets/${kind}-keyart.webp`);
 else {const d=ctx.getImageData(0,0,im.width,im.height).data,rects=[];for(let n=0;n<6;n++){const ox=n%3*512,oy=Math.floor(n/3)*512;let x0=512,y0=512,x1=0,y1=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(d[((oy+y)*im.width+ox+x)*4+3]>48){x0=Math.min(x,x0);y0=Math.min(y,y0);x1=Math.max(x,x1);y1=Math.max(y,y1);}x0=Math.max(0,x0-3);y0=Math.max(0,y0-3);x1=Math.min(511,x1+3);y1=Math.min(511,y1+3);rects.push([ox+x0,oy+y0,x1-x0+1,y1-y0+1]);}packs[kind]={prefix,rects};}
 }
}writeFileSync('games/atelier/web/art.mjs','// Sprite bounds measured from preserved ImageGen alpha.\nexport const packs='+JSON.stringify(packs,null,2)+';\n');console.log(packs);
