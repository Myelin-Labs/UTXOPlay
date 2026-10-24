// Original generated artwork. Source plates and full prompts: docs/arcade-premium-art.json.
// Tight alpha bounds are sampled directly: no CSS filters, masks or per-frame uploads.
export const packs={
 'neon-coil':{prefix:'coil',rects:{head:[46,55,472,441],body:[550,78,440,393],tail:[1032,127,471,309],seed:[99,572,365,349],node:[576,552,386,386],shard:[1077,578,392,335]}},
 starfall:{prefix:'starfall',rects:{player:[35,27,457,416],scarab:[574,34,389,478],manta:[1047,28,467,430],gunship:[34,521,459,453],reactor:[539,512,458,454],explosion:[1055,531,441,427]}},
 'drift-run':{prefix:'drift',rects:{car:[28,125,438,292],left:[525,126,488,296],right:[1057,127,449,299],barrier:[10,627,665,236],ring:[711,512,414,400],bollard:[1279,528,146,384]}},
 'prism-breaker':{prefix:'prism',rects:{amethyst:[40,61,452,142],aquamarine:[544,61,447,144],ruby:[1042,60,454,143],emerald:[40,276,453,144],citrine:[544,275,447,147],diamond:[1042,275,454,147],paddle:[43,526,620,115],orb:[796,483,193,194],shard:[1197,467,211,211],lens:[148,709,252,243],impact:[646,710,244,241],heart:[1147,732,234,211]}}
};
export const artUrl=(kind,name)=>`/arcade/art/${packs[kind].prefix}_${name}.webp?v=0.24.0`;
export async function loadArtwork(kind,cover){
 const sources=[['bg',artUrl(kind,'bg')],['atlas',artUrl(kind,'atlas')],['cover',cover]];
 let completed=0,failed=false;globalThis.UTXOPlayLoader?.assets(0,sources.length);
 try{
  const entries=await Promise.all(sources.map(async([name,source])=>{const image=typeof source==='string'?new Image():source;image.decoding='async';if(typeof source==='string')image.src=source;await image.decode();if(!failed)globalThis.UTXOPlayLoader?.assets(++completed,sources.length);return[name,image];}));
  return Object.fromEntries(entries);
 }catch(error){failed=true;globalThis.UTXOPlayLoader?.fail('assets');throw error;}
}
export function drawSprite(c,art,kind,name,x,y,w,h=w,alpha=1,angle=0){
 const rect=packs[kind].rects[name];if(!art?.atlas||!rect)return;
 const[sx,sy,sw,sh]=rect,scale=Math.min(w/sw,h/sh);c.save();c.globalAlpha*=alpha;c.translate(x,y);if(angle)c.rotate(angle);c.drawImage(art.atlas,sx,sy,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);c.restore();
}
export function coverImage(c,image,x,y,w,h){const s=Math.max(w/image.width,h/image.height);c.drawImage(image,x+(w-image.width*s)/2,y+(h-image.height*s)/2,image.width*s,image.height*s);}
