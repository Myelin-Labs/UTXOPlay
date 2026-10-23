// Short synthesized cues; no downloads or automatic audio playback.
export class ArcadeAudio {
  constructor() { this.context=null;this.enabled=false;this.lastShot=0; }
  unlock() { if(!this.enabled)return;try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{} }
  play(type) {
    const c=this.context;if(!this.enabled||!c||c.state!=='running')return;
    if(type==='shot'&&c.currentTime-this.lastShot<.13)return;
    if(type==='shot')this.lastShot=c.currentTime;
    const tones={brick:[720,1100,.09,'triangle',.035],bounce:[260,430,.07,'sine',.045],collect:[660,1320,.16,'sine',.05],enemy:[180,55,.16,'triangle',.04],damage:[150,45,.25,'sawtooth',.035],wave:[520,1040,.28,'sine',.045],shot:[950,400,.055,'triangle',.018],start:[440,880,.18,'sine',.04],count:[520,520,.055,'sine',.025]};
    const [from,to,duration,wave,volume]=tones[type]||tones.start;
    const o=c.createOscillator(),gain=c.createGain(),t=c.currentTime;
    o.type=wave;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(gain);gain.connect(c.destination);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();gain.disconnect();};
  }
}
