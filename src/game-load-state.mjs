export function initialLoad(){return {progress:0,phase:'Opening your game',detail:'Preparing the game window',steps:[false,false,false,false],error:'',ready:false};}
// Validate child reports after the caller verifies source window and same origin.
export function acceptLoadMessage(previous,data,game,attempt){
  if(previous.ready||!data||data.type!=='utxoplay:load'||data.game!==game||data.attempt!==attempt)return null;
  if(!Number.isInteger(data.progress)||data.progress<0||data.progress>100||data.progress<previous.progress)return null;
  if(!Array.isArray(data.steps)||data.steps.length!==4||!data.steps.every(x=>typeof x==='boolean'))return null;
  if(previous.steps.some((done,i)=>done&&!data.steps[i]))return null;
  if(typeof data.phase!=='string'||data.phase.length>100||typeof data.detail!=='string'||data.detail.length>180||typeof data.error!=='string'||data.error.length>240||typeof data.ready!=='boolean')return null;
  if(data.ready&&(!data.steps.every(Boolean)||data.progress!==100||data.error))return null;
  if(!data.ready&&data.progress===100)return null;
  return {progress:data.progress,phase:data.phase,detail:data.detail,steps:data.steps,error:data.error,ready:data.ready};
}
