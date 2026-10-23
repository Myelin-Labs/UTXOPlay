// Shared by the bundled first-party games. Only the owning, same-origin frame controls layout.
const embedded = window.parent !== window;
function start(){
  if(embedded) {
    // Request within the real input event; postMessage alone can lose activation.
    try {const doc=parent.document;if(!doc.fullscreenElement)doc.documentElement.requestFullscreen?.().catch(()=>{});} catch {}
    window.parent.postMessage({type:'utxoplay:game-start'},location.origin);
  }
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

if(embedded){
 const ready=()=>parent.postMessage({type:'utxoplay:game-ready'},location.origin);
 if(document.readyState==='complete')ready();else addEventListener('load',ready,{once:true});
}

// First-party branding remains visible inside each game's own canvas shell.
{
 const badge=document.createElement('a');badge.href='https://github.com/Myelin-Labs/Myelin';badge.target='_blank';badge.rel='noopener noreferrer';badge.title='Myelin based · off-chain host replay';badge.setAttribute('aria-label','Myelin based · off-chain host replay');badge.style.cssText='position:fixed;left:10px;bottom:10px;z-index:20;display:flex;align-items:center;gap:7px;padding:4px 8px 4px 4px;border-radius:8px;border:1px solid #b6a5ff44;background:#080b19eb;color:#e2ddff;font:700 9px system-ui;letter-spacing:.08em;text-decoration:none';
 const logo=document.createElement('img');logo.src='/assets/myelin-logo.png';logo.alt='';logo.style.cssText='width:24px;height:24px;border-radius:5px';badge.append(logo,document.createTextNode('MYELIN BASED'));document.body.append(badge);
}
