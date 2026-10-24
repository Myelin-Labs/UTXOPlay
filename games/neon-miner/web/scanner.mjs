import {tip} from './engine.mjs';
// Direction only: no simulation, target identification, value forecast or moving-ore lock.
export function aimingGuide(g,hx,hy){
 if(g.phase!==0||g.mode!=='mining')return null;
 const [tx,ty]=tip(g),dx=tx-500,dy=ty-100,length=Math.hypot(dx,dy);
 if(!length)return null;
 const reach=Math.max(170,260-(g.level-1)*2);
 return {start:{x:hx,y:hy},end:{x:hx+dx/length*reach,y:hy+dy/length*reach},reach};
}
