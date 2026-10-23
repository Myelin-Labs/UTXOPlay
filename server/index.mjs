import express from 'express';
import {teeworldsSockets} from './teeworlds-socket.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, verifyWallet } from './auth.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const games=JSON.parse(readFileSync(path.join(root,'server/catalog.json'),'utf8'));

export function createApp({dataDir=process.env.DATA_DIR||path.join(root,'data'), origin=process.env.PUBLIC_ORIGIN||'http://127.0.0.1:8790', verify=verifyWallet, runtimeFetch=fetch}={}) {
 mkdirSync(dataDir,{recursive:true,mode:0o700});
 const db=new DatabaseSync(path.join(dataDir,'platform.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,address TEXT,scheme TEXT,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,browser TEXT NOT NULL,message TEXT NOT NULL,address TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS plays(account TEXT NOT NULL,game TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(account,game));
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
 const app=express(); app.disable('x-powered-by'); app.set('trust proxy',1);
 const secure=origin.startsWith('https:');
 const cookie=(res,name,value,maxAge)=>res.cookie(name,value,{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge});
 function cookies(req) {return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(v=>v.length===2));}
 function account(req) {const t=cookies(req).utxoplay_session;if(!t)return null;return db.prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account WHERE s.token=? AND s.expires>?').get(digest(t),Date.now())||null;}
 function userView(a){return a?{id:a.id,address:a.address,guest:!a.address,scheme:a.scheme}:null;}
 function session(res,a) {const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),a,Date.now()+7*86400000);cookie(res,'utxoplay_session',token,7*86400000);}
 function limited(key,max,ms) {const now=Date.now();db.prepare('DELETE FROM limits WHERE key=? AND expires<?').run(key,now);const r=db.prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(key,now+ms);return r.count>max;}
 const needUser=(req,res,next)=>{req.account=account(req);if(!req.account)return res.status(401).json({error:'Start a guest session or sign in to play.'});next();};
 app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https://app.joy.id; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'"});
  if(secure && ['utxoplay.io','www.utxoplay.io'].includes(req.hostname)) return res.redirect(308,origin+req.originalUrl);
  if(req.path.startsWith('/api')||req.path.includes('/api/'))res.set('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin!==origin) return res.status(403).json({error:'Request origin rejected'});
  if(limited('request:'+req.ip,3000,60000))return res.status(429).json({error:'Too many requests. Please try again shortly.'});
  next();
 });
 app.use(express.json({limit:'24kb'}));
 app.get('/api/health',(_req,res)=>res.json({ok:true,service:'utxoplay',version:'0.2.4'}));
 app.get('/api/games',(_req,res)=>res.json({games}));
 app.get('/api/me',(req,res)=>res.json({user:userView(account(req))}));
 app.post('/api/guest',(req,res)=>{
  const existing=account(req);if(existing)return res.json({user:userView(existing)});
  if(limited('guest:'+req.ip,12,86400000))return res.status(429).json({error:'Guest limit reached. Connect a wallet to keep playing.'});
  const id=randomBytes(32).toString('hex');db.prepare('INSERT INTO accounts VALUES(?,NULL,NULL,?)').run(id,Date.now());session(res,id);res.json({user:userView({id})});
 });
 app.post('/api/auth/challenge',(req,res)=>{
  if(limited('challenge:'+req.ip,20,60000))return res.status(429).json({error:'Please wait before signing in again.'});
  const address=req.body?.address;
  if(typeof address!=='string'||!/^ckb1[a-z0-9]{30,250}$/.test(address))return res.status(400).json({error:'Select a CKB mainnet account'});
  const id=randomBytes(24).toString('hex'), browser=randomBytes(32).toString('hex'), expires=Date.now()+300000;
  const message=`UTXOPlay wants you to sign in.\n\nDomain: ${new URL(origin).host}\nURI: ${origin}\nNetwork: CKB mainnet\nAddress: ${address}\nNonce: ${id}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}\n\nThis signs you in to UTXOPlay. It does not authorize transactions or asset transfers.`;
  db.prepare('DELETE FROM challenges WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO challenges VALUES(?,?,?,?,?)').run(id,digest(browser),message,address,expires);cookie(res,'utxoplay_login',browser,300000);res.json({id,message,expires});
 });
 app.post('/api/auth/verify',async(req,res)=>{
  try {
   if(limited('verify:'+req.ip,20,60000))return res.status(429).json({error:'Please try again in a minute.'});
   const id=req.body?.id;if(typeof id!=='string')throw new Error('Missing login challenge');
   const challenge=db.prepare('SELECT * FROM challenges WHERE id=?').get(id);
   const browser=cookies(req).utxoplay_login;
   if(!challenge||challenge.expires<Date.now()||!browser||digest(browser)!==challenge.browser)throw new Error('Login challenge expired. Please connect again.');
   // Claim before awaiting verification. Concurrent submissions cannot reuse a nonce.
   db.prepare('DELETE FROM challenges WHERE id=?').run(id);
   const verified=await verify(challenge.message,req.body.proof,challenge.address);
   db.prepare('INSERT INTO accounts VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET address=excluded.address,scheme=excluded.scheme').run(verified.id,verified.address,verified.scheme,Date.now());
   const old=cookies(req).utxoplay_session;if(old)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(old));
   session(res,verified.id);cookie(res,'utxoplay_login','',0);res.json({user:userView(verified)});
  }catch(e){res.status(401).json({error:e.message||'Unable to verify wallet'});}
 });
 app.post('/api/auth/logout',(req,res)=>{const t=cookies(req).utxoplay_session;if(t)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(t));cookie(res,'utxoplay_session','',0);res.json({ok:true});});
 app.get('/api/library',needUser,(req,res)=>res.json({games:db.prepare('SELECT game,updated FROM plays WHERE account=? ORDER BY updated DESC').all(req.account.id)}));
 app.get('/api/developer/projects',needUser,(req,res)=>res.json({projects:db.prepare('SELECT * FROM projects WHERE owner=? ORDER BY created DESC').all(req.account.id)}));
 app.post('/api/developer/projects',needUser,(req,res)=>{
  if(!req.account.address)return res.status(403).json({error:'Connect a wallet to create a developer project.'});
  const {title,description,url}=req.body||{};
  if(typeof title!=='string'||title.trim().length<3||title.length>80||typeof description!=='string'||description.length>2000||typeof url!=='string'||url.length>500)return res.status(400).json({error:'Please provide a title, description, and HTTPS game URL.'});
  try {if(new URL(url).protocol!=='https:')throw 0;}catch{return res.status(400).json({error:'Use a valid HTTPS game URL.'});}
  if(db.prepare('SELECT count(*) AS n FROM projects WHERE owner=?').get(req.account.id).n>=10)return res.status(429).json({error:'Project limit reached.'});
  const id=randomBytes(12).toString('hex');db.prepare('INSERT INTO projects(id,owner,title,description,url,created) VALUES(?,?,?,?,?,?)').run(id,req.account.id,title.trim(),description.trim(),url,Date.now());res.status(201).json({id,status:'draft'});
 });
 app.use('/games/:game/api',needUser,async(req,res)=>{
  if(!games.some(g=>g.id===req.params.game))return res.status(404).json({error:'Unknown game'});
  const endpoint=req.path;
  if(!((req.method==='GET'&&['/state','/export'].includes(endpoint))||(req.method==='POST'&&['/new','/action','/replay'].includes(endpoint))))return res.status(404).json({error:'Unknown endpoint'});
  if(req.params.game==='teeworlds'&&req.body?.type==='create'&&limited(req.account.id+':teeworlds:create',20,3600000))return res.status(429).json({error:'Match creation limit reached. Please return later.'});
  if(req.method==='POST'&&limited(req.account.id+':'+req.params.game+':'+endpoint,req.params.game==='teeworlds'?1200:endpoint==='/new'?10:120,60000))return res.status(429).json({error:'Please wait before trying again.'});
  try {
   const base=req.params.game==='teeworlds'?(process.env.TEEWORLDS_URL||'http://127.0.0.1:8783'):req.params.game==='chess'?(process.env.CHESS_URL||'http://127.0.0.1:8781'):(process.env.SLING_URL||'http://127.0.0.1:8782');
   const result=await runtimeFetch(base+'/api'+endpoint,{method:req.method,headers:{'Content-Type':'application/json','X-Runtime-Token':process.env.RUNTIME_TOKEN||'','X-UTXOPlay-Account':req.account.id},body:req.method==='POST'?JSON.stringify(req.body||{}):undefined,signal:AbortSignal.timeout(20000)});
   const content=await result.text();
   if(result.ok && (req.params.game!=='teeworlds'||req.method==='POST'&&['create','join'].includes(req.body?.type)))db.prepare('INSERT INTO plays VALUES(?,?,?) ON CONFLICT(account,game) DO UPDATE SET updated=excluded.updated').run(req.account.id,req.params.game,Date.now());
   if(endpoint==='/export')res.set('Content-Disposition',`attachment; filename="utxoplay-${req.params.game}-session.json"`);
   res.status(result.status).type('json').send(content);
  }catch(e){console.error('runtime request failed',req.params.game,e.name);res.status(503).json({error:'The game is waking up. Please retry in a moment; your saved progress is safe.'});}
 });
 for(const game of games)app.use('/games/'+game.id,(_req,res,next)=>{res.set('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self' ${new URL(origin).protocol==='https:'?'wss:':'ws:'}//${new URL(origin).host}; object-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`);next();},express.static(path.join(root,'games',game.id,'web'),{index:'index.html',maxAge:0}));
 app.use('/api',(_req,res)=>res.status(404).json({error:'Unknown API endpoint'}));
 app.use(express.static(path.join(root,'dist'),{maxAge:'1h',index:false}));
 app.get('/{*path}',(_req,res)=>{res.set('Cache-Control','no-cache');res.sendFile(path.join(root,'dist','index.html'));});
 app.use((err,_req,res,_next)=>res.status(err.status||500).json({error:err.status===413?'Request too large':'Unable to complete request'}));
 const cleanup=setInterval(()=>{const t=Date.now();db.prepare('DELETE FROM sessions WHERE expires<?').run(t);db.prepare('DELETE FROM challenges WHERE expires<?').run(t);db.prepare('DELETE FROM limits WHERE expires<?').run(t);},60000);cleanup.unref();
 const sockets=teeworldsSockets({account,origin,limited});
 return {app,db,attachSockets:sockets.attach,close:()=>{sockets.close();clearInterval(cleanup);db.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.env.RUNTIME_TOKEN||process.env.RUNTIME_TOKEN.length<32)throw new Error('RUNTIME_TOKEN must be set');
 const service=createApp();const server=service.app.listen(Number(process.env.PORT||8790),process.env.BIND||'127.0.0.1',()=>console.log('UTXOPlay listening on '+(process.env.PORT||8790)));
 service.attachSockets(server);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{service.close();server.close(()=>process.exit(0));});
}
