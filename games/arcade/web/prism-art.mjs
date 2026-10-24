export const prismNames=['amethyst','aquamarine','ruby','emerald','citrine','diamond','paddle','orb','shard','lens','impact','heart','sanctum','aurora'];
export const prismArtUrl=name=>`/games/prism-breaker/art/${name}.webp`;
export async function loadPrismArt(cover){
 const sources=[...prismNames.map(name=>[name,prismArtUrl(name)]),['cover',cover]];
 let completed=0;globalThis.UTXOPlayLoader?.assets(0,sources.length);
 try {
  const entries=await Promise.all(sources.map(async([name,source])=>{const image=typeof source==='string'?new Image():source;image.decoding='async';if(typeof source==='string')image.src=source;await image.decode();globalThis.UTXOPlayLoader?.assets(++completed,sources.length);return [name,image];}));
  return Object.fromEntries(entries);
 }catch(error){globalThis.UTXOPlayLoader?.fail('assets');throw error;}
}
