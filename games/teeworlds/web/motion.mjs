// Presentation only. Native snapshots remain the authority for physics and replay.
// Teeworlds velocity is fixed-point (256 units) per 20 ms simulation tick.
const TICK_MS=20, VELOCITY_SCALE=256, PREDICTION_MS=40, CORRECTION_MS=45;
export class CharacterMotion {
  constructor(characterType,constrain=(x,y,tx,ty)=>[tx,ty]){this.type=characterType;this.constrain=constrain;this.reset();}
  reset(){this.entries=new Map();this.tick=-1;}
  position(entry,now){
    const age=Math.max(0,now-entry.received),ahead=Math.min(age,PREDICTION_MS)/TICK_MS;
    const d=entry.data;
    const [x,y]=this.constrain(d[1],d[2],d[1]+d[3]/VELOCITY_SCALE*ahead,d[2]+d[4]/VELOCITY_SCALE*ahead);
    const decay=Math.exp(-age/CORRECTION_MS);
    return [x+entry.errorX*decay,y+entry.errorY*decay];
  }
  push(state,now){
    if(state.tick<=this.tick)return false;
    this.tick=state.tick;
    const next=new Map();
    for(const [type,id,data] of state.items){
      if(type!==this.type)continue;
      const old=this.entries.get(id),entry={type,id,data:[...data],received:now,errorX:0,errorY:0};
      // Death/respawn and large teleports begin a new visual track.
      if(old&&Math.hypot(data[1]-old.data[1],data[2]-old.data[2])<250){
        const [x,y]=this.position(old,now);entry.errorX=x-data[1];entry.errorY=y-data[2];
      }
      next.set(id,entry);
    }
    this.entries=next;return true;
  }
  sample(now){return [...this.entries.values()].map(entry=>{const d=[...entry.data];[d[1],d[2]]=this.position(entry,now);return [entry.type,entry.id,d];});}
}
// Clamp visual extrapolation at collision tiles. Never predict through a wall.
export function constrainCharacter(map,x,y,tx,ty){
  const solid=(px,py)=>{const ix=Math.floor(px/32),iy=Math.floor(py/32);if(ix<0||iy<0||ix>=map.width||iy>=map.height)return true;const t=map.tiles[iy*map.width+ix];return t===1||t===3;};
  const free=(px,py)=>![-14,14].some(dx=>[-14,14].some(dy=>solid(px+dx,py+dy)));
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(tx-x),Math.abs(ty-y))/4));
  const dx=(tx-x)/steps,dy=(ty-y)/steps;
  for(let i=0;i<steps;i++){if(free(x+dx,y))x+=dx;if(free(x,y+dy))y+=dy;}
  return [x,y];
}
export function followCamera(camera,target,dt,snap=false){
  const alpha=snap?1:1-Math.exp(-Math.max(0,Math.min(dt,100))/70);
  return {x:camera.x+(target[1]-camera.x)*alpha,y:camera.y+(target[2]-camera.y)*alpha};
}
