// UCI is a text protocol. The separately distributed Stockfish worker is GPLv3.
const URL='/games/chess/engine/stockfish-17.1-lite-single-03e3232.js';
const levels={rookie:{skill:0,ms:180},club:{skill:7,ms:500},expert:{skill:16,ms:1100}};
export class ChessEngine {
  constructor(){this.worker=null;this.pending=null;this.ready=false;this.idle=null;}
  run({moves,level,onMove,onError}){
    this.cancel();clearTimeout(this.idle);
    this.pending={moves,level,onMove,onError};
    if(!this.worker){
      try{
        const worker=this.worker=new Worker(URL);
        this.worker.onerror=()=>this.worker===worker && this.fail('The chess engine could not load. Reconnect and resume the computer.');
        this.worker.onmessage=({data})=>{if(this.worker===worker)this.message(String(data));};
        this.worker.postMessage('uci');
      }catch{this.fail('This browser could not start Stockfish.');}
    }else if(this.ready)this.search();
  }
  message(line){
    if(line==='uciok'){this.worker.postMessage('setoption name Hash value 16');this.worker.postMessage('isready');}
    if(line==='readyok'){this.ready=true;if(this.pending)this.search();}
    if(line.startsWith('bestmove ')&&this.pending){
      const request=this.pending;this.pending=null;request.onMove(line.split(/\s+/)[1]);
      this.idle=setTimeout(()=>this.dispose(),60000);
    }
  }
  search(){
    const request=this.pending,level=levels[request.level]||levels.club;
    this.worker.postMessage('setoption name Skill Level value '+level.skill);
    this.worker.postMessage('position startpos'+(request.moves.length?' moves '+request.moves.join(' '):''));
    this.worker.postMessage('go movetime '+level.ms);
  }
  fail(message){const request=this.pending;this.dispose();request?.onError(message);}
  cancel(){if(this.pending)this.dispose();}
  dispose(){clearTimeout(this.idle);this.worker?.terminate();this.worker=null;this.pending=null;this.ready=false;}
}
