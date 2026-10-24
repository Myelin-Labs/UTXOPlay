import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {createApp} from '../server/index.mjs';
const dir=mkdtempSync('/tmp/community-tests-'),origin='https://store.utxoplay.io';
const service=createApp({dataDir:dir,origin,verify:async(_m,proof,address)=>({id:proof.id,address,scheme:'test-only'}),runtimeFetch:async(_url,opts)=>new Response(JSON.stringify({game:{}}),{status:JSON.parse(opts.body||'{}').bad?400:200})});
const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
async function req(url,body,cookie='',headers={}){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
async function login(id){const address='ckb1'+'q'.repeat(40);const c=await req('/api/auth/challenge',{address});return req('/api/auth/verify',{id:c.data.id,proof:{id}},c.cookie);}
const a=await login('wallet-a'),b=await login('wallet-b'),guest=await req('/api/guest',{});
after(async()=>{await new Promise(r=>server.close(r));service.close();rmSync(dir,{recursive:true,force:true});});
const review={recommended:true,stars:4,body:'Wonderful art, but the last sector could be harder.'};
test('username requires wallet authentication, validates input and is case-insensitively unique',async()=>{
 assert.equal((await req('/api/profile',{username:'GuestName'},guest.cookie)).status,403);
 for(const username of [123,{},null,'ab','Admin','x<script>','ab\u202ecd'])assert.equal((await req('/api/profile',{username},a.cookie)).status,400);
 assert.equal((await req('/api/profile',{username:'Pilot_01'},a.cookie)).status,200);
 assert.equal((await req('/api/profile',{username:'pilot_01'},b.cookie)).status,409);
 assert.equal((await req('/api/profile',{username:'Other',account:'wallet-a'},b.cookie)).status,400);
 assert.equal((await req('/api/me',undefined,a.cookie)).data.user.username,'Pilot_01');
 const again=await login('wallet-a');assert.equal(again.data.user.username,'Pilot_01');
});
test('reviews require successful game actions; polling, replay, rejected actions and guests do not qualify',async()=>{
 assert.equal((await req('/api/community/neon-miner/review',review,guest.cookie)).status,403);
 assert.equal((await req('/api/community/neon-miner/review',review,a.cookie)).status,403);
 await req('/games/neon-miner/api/state',undefined,a.cookie);await req('/games/neon-miner/api/replay',{},a.cookie);await req('/games/neon-miner/api/action',{bad:true},a.cookie);
 assert.equal((await req('/api/community/neon-miner',undefined,a.cookie)).data.eligible,false);
 await req('/games/neon-miner/api/action',{action:{type:'tick'}},a.cookie);
 assert.equal((await req('/api/community/neon-miner/review',review,a.cookie)).status,200);
 assert.equal((await req('/api/community/sling/review',review,a.cookie)).status,403);
 assert.equal((await req('/api/community/no-game/review',review,a.cookie)).status,404);
});
test('review update is unique, aggregates are honest, and public payloads omit account identity',async()=>{
 assert.equal((await req('/api/community/neon-miner/review',{...review,stars:9},a.cookie)).status,400);
 assert.equal((await req('/api/community/neon-miner/review',{...review,account:'wallet-b'},a.cookie)).status,400);
 assert.equal((await req('/api/community/neon-miner/review',{...review,body:'<script>alert("x")</script> This is plain text.'},a.cookie)).status,200);
 let d=(await req('/api/community/neon-miner',undefined,a.cookie)).data;assert.equal(d.overall.total,1);assert.equal(d.overall.stars,4);assert.equal(d.reviews[0].author,'Pilot_01');assert.equal(d.reviews[0].mine,true);assert.equal(d.reviews[0].account,undefined);assert.equal(d.reviews[0].address,undefined);
 await req('/games/neon-miner/api/action',{},b.cookie);await req('/api/community/neon-miner/review',{...review,recommended:false,stars:2},b.cookie);
 d=(await req('/api/community/neon-miner?filter=negative')).data;assert.equal(d.overall.total,2);assert.equal(d.overall.positive,1);assert.equal(d.overall.stars,3);assert.equal(d.total,1);assert.equal(d.reviews.length,1);assert.equal(d.reviews[0].recommended,false);
 service.db.prepare('UPDATE reviews SET created=? WHERE account=?').run(Date.now()-31*86400000,'wallet-b');d=(await req('/api/community/neon-miner')).data;assert.equal(d.recent.total,1);assert.equal(d.overall.total,2);
});
test('votes are idempotent, self-votes fail, comments and deletes enforce ownership',async()=>{
 const id=(await req('/api/community/neon-miner',undefined,a.cookie)).data.mine.id;
 assert.equal((await req(`/api/reviews/${id}/helpful`,{helpful:true},a.cookie)).status,400);
 await req(`/api/reviews/${id}/helpful`,{helpful:true},b.cookie);await req(`/api/reviews/${id}/helpful`,{helpful:true},b.cookie);
 assert.equal((await req('/api/community/neon-miner',undefined,b.cookie)).data.reviews.find(r=>r.id===id).helpful,1);
 await req(`/api/reviews/${id}/comments`,{body:'Thanks for this useful feedback.'},b.cookie);
 const comment=(await req(`/api/reviews/${id}/comments`)).data.comments[0];assert.equal(comment.account,undefined);
 await req(`/api/comments/${comment.id}/delete`,{},a.cookie);assert.equal((await req(`/api/reviews/${id}/comments`)).data.total,1);
 await req(`/api/comments/${comment.id}/delete`,{},b.cookie);assert.equal((await req(`/api/reviews/${id}/comments`)).data.total,0);
 assert.equal((await req(`/api/reviews/${id}/comments`,{body:'Hi'},guest.cookie)).status,403);
 assert.equal((await req(`/api/reviews/${id}/comments`,{body:'Hi'},b.cookie,{Origin:'https://evil.invalid'})).status,403);
});
test('reports persist without vote-based censorship; hidden reviews cannot be resurrected',async()=>{
 const id=(await req('/api/community/neon-miner',undefined,a.cookie)).data.mine.id;
 await req('/api/community-report',{kind:'review',target:id,reason:'Test moderation report'},b.cookie);
 await req('/api/community-report',{kind:'review',target:id,reason:'Duplicate report'},b.cookie);
 assert.equal(service.db.prepare('SELECT count(*) n FROM community_reports').get().n,1);
 assert.equal((await req('/api/community/neon-miner')).data.overall.total,2);
 service.db.prepare('UPDATE reviews SET hidden=1 WHERE id=?').run(id);
 assert.equal((await req('/api/community/neon-miner')).data.overall.total,1);
 assert.equal((await req('/api/community/neon-miner/review',review,a.cookie)).status,403);
 await req('/api/community/neon-miner/review/delete',{},a.cookie);
 assert.equal((await req('/api/community/neon-miner/review',review,a.cookie)).status,403);
 assert.equal((await req(`/api/reviews/${id}/comments`)).status,404);
});
test('review deletion cascades to replies and votes, and other wallets keep their own review',async()=>{
 const id=(await req('/api/community/neon-miner',undefined,b.cookie)).data.mine.id;
 await req(`/api/reviews/${id}/comments`,{body:'A reply to remove'},b.cookie);
 await req('/api/community/neon-miner/review/delete',{},b.cookie);
 assert.equal((await req(`/api/reviews/${id}/comments`)).status,404);
 assert.equal(service.db.prepare('SELECT count(*) n FROM review_comments WHERE review=?').get(id).n,0);
 assert.equal(service.db.prepare('SELECT count(*) n FROM reviews WHERE account=?').get('wallet-a').n,1);
});
