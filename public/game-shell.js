// Shared by the bundled first-party games. Only the owning, same-origin frame controls layout.
const embedded = window.parent !== window;
function start(){
  if(embedded) window.parent.postMessage({type:'utxoplay:game-start'},location.origin);
  else {document.documentElement.classList.add('immersive-game');document.documentElement.requestFullscreen?.().catch(()=>{});}
}
function exit(){
  if(embedded) window.parent.postMessage({type:'utxoplay:exit-immersive'},location.origin);
  else {document.documentElement.classList.remove('immersive-game');if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});}
}
addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='utxoplay:immersion')document.documentElement.classList.toggle('immersive-game',!!e.data.enabled);});
// Capture the real click before async game requests consume user activation.
document.addEventListener('utxoplay:game-start',start);
document.addEventListener('click',e=>{if(e.target.closest('#new,#launch,#continue,#practice,#create,#join'))start();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')exit();});
if(!embedded){const b=document.createElement('button');b.className='standalone-fullscreen';b.textContent='Fullscreen';b.onclick=()=>document.documentElement.classList.contains('immersive-game')?exit():start();document.body.append(b);document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.documentElement.classList.remove('immersive-game');});}
