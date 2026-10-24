import {randomBytes, createHash} from 'node:crypto';

// Seats are authenticated by the Store. The existing native Myelin runtime owns
// chess legality, stale-head rejection, durable state and signed replay evidence.
export function installChessRooms({app,db,account,needUser,limited,runtimeFetch,recordPlay,community}) {
  db.exec(`CREATE TABLE IF NOT EXISTS chess_rooms(id TEXT PRIMARY KEY,white TEXT REFERENCES accounts(id),black TEXT REFERENCES accounts(id),created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS chess_room_white ON chess_rooms(white);
    CREATE INDEX IF NOT EXISTS chess_room_black ON chess_rooms(black);`);
  const streams=new Set(), locks=new Map(), cache=new Map();
  const base='/games/chess/api/rooms';
  const error=(status,message)=>Object.assign(new Error(message),{status});
  const seat=(room,id)=>room.white===id?'white':room.black===id?'black':null;
  function roomFor(id,user,member=true) {
    if(!/^[a-f0-9]{24}$/.test(id||''))throw error(404,'Table not found. Check your invitation.');
    const room=db.prepare('SELECT * FROM chess_rooms WHERE id=?').get(id);
    if(!room)throw error(404,'Table not found. Check your invitation.');
    if(member&&!seat(room,user))throw error(403,'Join this table using its invitation first.');
    return room;
  }
  async function locked(id,fn) {
    if(locks.has(id))throw error(409,'This table is updating. Please try again.');
    locks.set(id,true);
    try{return await fn();}finally{locks.delete(id);}
  }
  async function runtime(id,endpoint,body) {
    const runtimeAccount=createHash('sha256').update('utxoplay:chess:room:'+id).digest('hex');
    const response=await runtimeFetch((process.env.CHESS_URL||'http://127.0.0.1:8781')+'/api/'+endpoint,{
      method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Runtime-Token':process.env.RUNTIME_TOKEN||'','X-UTXOPlay-Account':runtimeAccount},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(!response.ok)throw error(response.status===400?409:503,result.error||'The table could not be updated. Reconnect to recover its saved position.');
    return result;
  }
  function remember(id,state) {
    const existing=cache.get(id)?.state;
    if(existing?.session.id===state.session.id && (existing.session.actions??existing.session.height)>(state.session.actions??state.session.height))return existing;
    cache.delete(id);cache.set(id,{state,at:Date.now()});
    if(cache.size>64)cache.delete(cache.keys().next().value);
    return state;
  }
  async function state(id) {
    const hit=cache.get(id);
    if(hit&&Date.now()-hit.at<30000)return hit.state;
    return remember(id,await runtime(id,'state'));
  }
  function view(room,user,state) {
    const color=seat(room,user),players={};
    for(const side of ['white','black'])players[side]=room[side]?{name:community.profile(room[side])||(side==='white'?'Ivory player':'Jade player')}:null;
    return {...state,room:{id:room.id,color,ready:!!(room.white&&room.black),players,created:room.created}};
  }
  function send(stream,room,value) {
    if(account(stream.req)?.id!==stream.user){stream.res.end();streams.delete(stream);return;}
    if(!stream.res.write('event: position\ndata: '+JSON.stringify(view(room,stream.user,value))+'\n\n'))stream.res.end();
  }
  function broadcast(room,value) {
    for(const stream of streams)if(stream.room===room.id)send(stream,room,value);
  }
  const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){if(!res.headersSent)res.status(e.status||503).json({error:e.status?e.message:'The table is reconnecting. Your saved moves are safe.'});else res.end();}};
  app.get(base,needUser,route(async(req,res)=>{
    const rows=db.prepare('SELECT * FROM chess_rooms WHERE white=? OR black=? ORDER BY created DESC LIMIT 20').all(req.account.id,req.account.id);
    res.json({rooms:rows.map(room=>({id:room.id,color:seat(room,req.account.id),ready:!!(room.white&&room.black),created:room.created}))});
  }));
  app.post(base,needUser,route(async(req,res)=>{
    if(limited(req.account.id+':chess-room-create',12,86400000))throw error(429,'Daily table limit reached. Rejoin one of your existing tables.');
    const color=req.body?.color;
    if(!['white','black'].includes(color)||Object.keys(req.body).some(k=>k!=='color'))throw error(400,'Choose White or Black.');
    const id=randomBytes(12).toString('hex');
    db.prepare('INSERT INTO chess_rooms VALUES(?,?,?,?)').run(id,color==='white'?req.account.id:null,color==='black'?req.account.id:null,Date.now());
    const room=roomFor(id,req.account.id);
    res.status(201).json(view(room,req.account.id,await state(id)));
  }));
  app.post(base+'/:id/join',needUser,route(async(req,res)=>{
    if(limited(req.account.id+':chess-room-join',30,60000))throw error(429,'Please wait before joining another table.');
    await locked(req.params.id,async()=>{
      let room=roomFor(req.params.id,req.account.id,false);
      if(!seat(room,req.account.id)){
        const color=!room.white?'white':!room.black?'black':null;
        if(!color)throw error(409,'Both seats are taken. Ask your friend to create another table.');
        db.prepare(`UPDATE chess_rooms SET ${color}=? WHERE id=? AND ${color} IS NULL`).run(req.account.id,room.id);
        room=roomFor(room.id,req.account.id);
      }
      const current=await state(room.id);broadcast(room,current);res.json(view(room,req.account.id,current));
    });
  }));
  app.get(base+'/:id/state',needUser,route(async(req,res)=>{
    const room=roomFor(req.params.id,req.account.id);res.json(view(room,req.account.id,await state(room.id)));
  }));
  app.post(base+'/:id/action',needUser,route(async(req,res)=>{
    if(limited(req.account.id+':chess-room-action',90,60000))throw error(429,'Please slow down.');
    await locked(req.params.id,async()=>{
      const room=roomFor(req.params.id,req.account.id);
      if(!room.white||!room.black)throw error(409,'Waiting for your friend to join.');
      const before=await state(room.id),body=req.body||{};
      if(seat(room,req.account.id)!==before.game.turn)throw error(403,'It is your opponent’s turn.');
      if(body.session_id!==before.session.id||body.expected_block!==before.session.block_hash)throw error(409,'The board has changed. Reconnect to the latest position.');
      if(Object.keys(body).some(k=>!['action','expected_block','session_id'].includes(k))||!['move','resign','claim_draw'].includes(body.action?.type))throw error(400,'Unsupported chess action.');
      try{
        const next=remember(room.id,await runtime(room.id,'action',body));
        for(const player of [room.white,room.black]){recordPlay.run(player,'chess',Date.now(),1);community.recordPlay(player,'chess');}
        broadcast(room,next);res.json(view(room,req.account.id,next));
      }catch(e){cache.delete(room.id);throw e;}
    });
  }));
  for(const endpoint of ['replay','export'])app[endpoint==='export'?'get':'post'](base+'/:id/'+endpoint,needUser,route(async(req,res)=>{
    const room=roomFor(req.params.id,req.account.id);
    if(limited(req.account.id+':chess-room-evidence',10,60000))throw error(429,'Please wait before requesting another replay.');
    if(endpoint==='export')res.set('Content-Disposition','attachment; filename="quiet-board-'+room.id+'.json"');
    res.json(await runtime(room.id,endpoint,endpoint==='replay'?{}:undefined));
  }));
  app.get(base+'/:id/events',needUser,route(async(req,res)=>{
    const room=roomFor(req.params.id,req.account.id);
    if(streams.size>=200||[...streams].filter(s=>s.user===req.account.id).length>=3)throw error(429,'Too many open tables. Close another game tab.');
    const current=await state(room.id);
    res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
    const stream={res,req,user:req.account.id,room:room.id};streams.add(stream);
    res.write('retry: 2000\n\n');send(stream,roomFor(room.id,req.account.id),current);
    req.on('close',()=>streams.delete(stream));
  }));
  const heartbeat=setInterval(()=>{
    for(const s of streams){if(account(s.req)?.id!==s.user){s.res.end();streams.delete(s);}else if(!s.res.write(': heartbeat\n\n'))s.res.end();}
  },15000);heartbeat.unref();
  return {close(){clearInterval(heartbeat);for(const s of streams)s.res.end();streams.clear();cache.clear();}};
}
