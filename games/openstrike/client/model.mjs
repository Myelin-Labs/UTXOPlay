export const defaults=Object.freeze({sensitivity:1,fov:76,sound:true,volume:.65,motion:true,touch:false});
export function settings(value={}){const finite=(v,f,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):f;return {sensitivity:finite(value.sensitivity,1,.4,2.5),fov:finite(value.fov,76,65,95),volume:finite(value.volume,.65,0,1),sound:typeof value.sound==='boolean'?value.sound:true,motion:typeof value.motion==='boolean'?value.motion:true,touch:typeof value.touch==='boolean'?value.touch:false};}
export function roomCode(value){return String(value||'').trim().toLowerCase();}
export function validRoomCode(value){return /^[a-f0-9]{24}$/.test(roomCode(value));}
export function roundResult(room){const winner=room?.state?.phase?.Ended?.winner;return !winner?'ROUND DRAW':winner===(room.slot?'B':'A')?'ROUND WON':'ROUND LOST';}
export function canRematch(room){return !!room&&['finished','failed','interrupted','expired','cancelled'].includes(room.status);}
export function backoff(attempt){return Math.min(10000,500*2**Math.min(5,Math.max(0,attempt)));}
export function neutralInput(sequence,tick,yaw=0,pitch=0){return {sequence,client_tick:tick,move_x:0,move_y:0,yaw,pitch,walk:false,jump:false,fire:false,reload:false};}
