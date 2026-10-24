import {tip,step,oreValue} from './engine.mjs';
// Replay the actual future cast on a disposable copy, including moving ore and armor.
export function scan(g){
 const copy=structuredClone(g);copy.previous=0;step(copy,1);
 for(let n=0;n<60&&copy.phase===1&&copy.mode==='mining';n++)step(copy,0);
 const index=copy.cargo>=0?copy.cargo:copy.ores.findIndex((o,n)=>o.armor<g.ores[n].armor);
 const ore=index>=0?copy.ores[index]:null;
 return {ore,point:tip(copy),index,cracked:!!ore&&copy.cargo<0,value:ore?oreValue(g,ore):0};
}
