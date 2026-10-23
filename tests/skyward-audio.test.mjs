import test from 'node:test';
import assert from 'node:assert/strict';
let id=0;
async function setup(saved) {
  const values=new Map(saved ? [['skyward:audio',JSON.stringify(saved)]] : []);
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const doc=new EventTarget();doc.hidden=false;globalThis.document=doc;
  const instances=[],contexts=[];
  class Audio extends EventTarget {
    constructor(src){super();this.src=src;this.calls=0;this.paused=true;instances.push(this);}
    play(){this.calls++;if(this.fail)return Promise.reject(Error('Playback blocked'));this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
  }
  const node=()=>({gain:{value:1,setTargetAtTime(v){this.value=v;},setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(target){this.output=target;return target;},start(){},stop(){}});
  class Context {
    constructor(){this.destination={};this.currentTime=0;this.gains=[];this.oscillators=[];contexts.push(this);}
    resume(){this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    createGain(){const n=node();this.gains.push(n);return n;}
    createBiquadFilter(){return node();}
    createOscillator(){const n=node();this.oscillators.push(n);return n;}
  }
  globalThis.Audio=Audio;globalThis.window={AudioContext:Context};
  const api=await import(`../games/sling/web/audio.js?test=${++id}`);
  return {api,doc,media:instances[0],contexts,values};
}
test('Skyward starts music on interaction and remembers mute and volume',async()=>{
  const {api,media,contexts,values}=await setup();
  assert.equal(media.calls,0,'page load cannot autoplay');
  assert.equal(api.audioState().enabled,true);
  const start=api.startSound();assert.equal(media.calls,1,'play called synchronously in the gesture');await start;
  assert.equal(api.audioState().playing,true);assert.equal(media.loop,true);
  api.volume(0.17);api.sound('hit');assert.equal(media.volume,0.17);assert.equal(contexts[0].gains[0].gain.value,0.17);
  assert.equal(contexts[0].oscillators.length,2);
  await api.toggleSound();assert.equal(media.paused,true);assert.equal(contexts[0].state,'suspended');
  const saved=JSON.parse(values.get('skyward:audio'));assert.deepEqual(saved,{enabled:false,volume:0.17});
  const reload=await setup(saved);await reload.api.startSound();assert.equal(reload.media.calls,0);
  await reload.api.toggleSound();assert.equal(reload.media.calls,1);assert.equal(reload.api.audioState().playing,true);
});
test('Skyward retries blocked music and suspends all audio while hidden',async()=>{
  const {api,media,doc,contexts}=await setup();media.fail=true;
  await api.startSound();assert.equal(api.audioState().playing,false);
  media.fail=false;await api.toggleSound();assert.equal(api.audioState().playing,true);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(media.paused,true);assert.equal(contexts[0].state,'suspended');
  api.sound('win');assert.equal(contexts[0].oscillators.length,0);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setImmediate(r));
  assert.equal(api.audioState().playing,true);assert.equal(contexts[0].state,'running');
});
