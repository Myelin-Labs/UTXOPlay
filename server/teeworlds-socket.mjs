import {WebSocket,WebSocketServer} from 'ws';

// The public socket is bound to the same revocable cookie session as HTTP.
// Only the store supplies runtime credentials and the authenticated account id.
export function teeworldsSockets({account,origin,limited}) {
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 const peers=new Map();
 function reject(socket,status){socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);}
 function upgrade(req,socket,head){
  socket.on('error',()=>socket.destroy());
  if(wss.clients.size>=128)return reject(socket,'503 Service Unavailable');
  const game=req.url==='/games/teeworlds/api/socket'?'teeworlds':req.url==='/games/openstrike/api/socket'?'openstrike':null;
  if(!game)return reject(socket,'404 Not Found');
  if(req.headers.origin!==origin)return reject(socket,'403 Forbidden');
  const user=account(req);if(!user)return reject(socket,'401 Unauthorized');
  if((peers.get(user.id)?.size||0)>=3||limited(user.id+':socket',30,60000))return reject(socket,'429 Too Many Requests');
  wss.handleUpgrade(req,socket,head,client=>{
   const group=peers.get(user.id)||new Set();group.add(client);peers.set(user.id,group);
   const url=new URL('/api/socket',game==='openstrike'?(process.env.OPENSTRIKE_URL||'http://127.0.0.1:8784'):(process.env.TEEWORLDS_URL||'http://127.0.0.1:8783'));url.protocol=url.protocol==='https:'?'wss:':'ws:';
   const upstream=new WebSocket(url,{headers:{'X-Runtime-Token':process.env.RUNTIME_TOKEN||'','X-UTXOPlay-Account':user.id},maxPayload:65536,perMessageDeflate:false,handshakeTimeout:5000});
   let windowStart=Date.now(),messages=0;client.alive=true;
   const valid=()=>account(req)?.id===user.id;
   const shutdown=()=>{client.terminate();upstream.terminate();};
   client.on('pong',()=>{client.alive=true;});
   const timer=setInterval(()=>{if(!valid()||!client.alive)return shutdown();client.alive=false;client.ping();},5000);timer.unref();
   client.on('error',shutdown);upstream.on('error',shutdown);
   client.on('close',()=>{clearInterval(timer);group.delete(client);if(!group.size)peers.delete(user.id);upstream.terminate();});
   upstream.on('close',()=>client.close(1013,'Realtime disconnected'));
   client.on('message',(raw,binary)=>{
    if(!valid())return shutdown();
    if(Date.now()-windowStart>=1000){windowStart=Date.now();messages=0;}
    if(binary||++messages>120||upstream.bufferedAmount>65536)return shutdown();
    if(upstream.readyState===WebSocket.OPEN)upstream.send(raw,{binary:false});
   });
   upstream.on('message',(raw,binary)=>{
    if(!valid()||binary||client.bufferedAmount>65536)return shutdown();
    if(client.readyState===WebSocket.OPEN)client.send(raw,{binary:false});
   });
  });
 }
 return {attach:server=>server.on('upgrade',upgrade),close:()=>{for(const ws of wss.clients)ws.terminate();wss.close();}};
}
