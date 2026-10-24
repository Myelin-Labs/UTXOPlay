// The engine import resolves after the arena and WebGL scene are created.
const loader=globalThis.UTXOPlayLoader;
let engineReady=false;
try {await import('./app.js');loader?.boot();engineReady=true;}
catch {loader?.fail('game');}
if(engineReady){
  if(!document.getElementById('fatal').hidden)loader?.fail('graphics');
  else {
    loader?.assets(1,1);
    try {
      const response=await fetch('./api/state',{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Session unavailable');
      await response.json();loader?.session();loader?.ready();
    } catch {loader?.fail('session');}
  }
}
