// Extract authored sprite regions; no procedural artwork is synthesized here.
// Optional dependency: ARCADE_TEST_MODULES=/tmp/utxoplay-render-check/node_modules
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const require=createRequire(process.env.ARCADE_TEST_MODULES?resolve(process.env.ARCADE_TEST_MODULES,'../package.json'):import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const dir='games/prism-breaker/web/art';mkdirSync(dir,{recursive:true});const atlas=await loadImage('assets/prism-breaker-source/atlas.png');
const parts=[
 ['amethyst',[28,70,460,137],'brick'],['aquamarine',[540,69,461,137],'brick'],['ruby',[1054,68,455,137],'brick'],
 ['emerald',[30,299,458,137],'brick'],['citrine',[540,298,461,138],'brick'],['diamond',[1053,299,456,137],'brick'],
 ['paddle',[46,554,590,126],'paddle'],['orb',[762,523,176,174],'circle'],['shard',[1220,482,125,246],'shard'],
 ['lens',[165,752,209,207],'circle'],['impact',[624,716,321,282],'star'],['heart',[1170,778,221,204],'heart']
];
function mask(c,type){c.beginPath();if(type==='circle')c.ellipse(.5,.5,.49,.49,0,0,Math.PI*2);
 else if(type==='heart'){c.moveTo(.5,.96);c.bezierCurveTo(.17,.7,-.12,.43,.05,.15);c.bezierCurveTo(.17,-.04,.4,0,.5,.15);c.bezierCurveTo(.65,-.08,.95,.02,.98,.25);c.bezierCurveTo(1.05,.49,.76,.76,.5,.96);}
 else{const points=type==='brick'?[[.07,0],[.93,0],[1,.25],[1,.75],[.93,1],[.07,1],[0,.75],[0,.25]]:type==='paddle'?[[0,.51],[.1,.23],[.15,.27],[.25,.17],[.35,.19],[.42,.04],[.49,.02],[.57,.22],[.72,.2],[.8,.25],[.9,.22],[1,.51],[.9,.79],[.82,.73],[.73,.84],[.57,.82],[.5,1],[.42,.97],[.35,.83],[.2,.83],[.12,.74]]:type==='shard'?[[.75,0],[1,.39],[.73,.72],[.37,1],[.01,.53],[.13,.29]]:[[.5,0],[.56,.43],[1,.5],[.57,.57],[.5,1],[.43,.57],[0,.5],[.43,.43]];for(const [i,p]of points.entries())i?c.lineTo(...p):c.moveTo(...p);c.closePath();}c.clip();}
for(const [name,[x,y,w,h],shape]of parts){const width=name==='paddle'?512:name==='shard'?96:256,height=Math.round(h/w*width),can=createCanvas(width,height),c=can.getContext('2d');c.save();c.scale(width,height);mask(c,shape);c.drawImage(atlas,x,y,w,h,0,0,1,1);c.restore();writeFileSync(`${dir}/${name}.webp`,can.toBuffer('image/webp',90));}
for(const name of ['sanctum','aurora','cover']){const img=await loadImage(`assets/prism-breaker-source/${name}.png`),width=name==='cover'?1536:1280,height=Math.round(img.height/img.width*width),can=createCanvas(width,height);can.getContext('2d').drawImage(img,0,0,width,height);const file=name==='cover'?'public/assets/prism-breaker-keyart.webp':`${dir}/${name}.webp`;writeFileSync(file,can.toBuffer('image/webp',85));}
const manifest=Object.fromEntries([...parts.map(p=>p[0]),'sanctum','aurora'].map(name=>{const bytes=readFileSync(`${dir}/${name}.webp`);return [name,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}];}));writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');console.log(manifest);
