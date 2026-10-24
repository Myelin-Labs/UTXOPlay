import {randomUUID} from 'node:crypto';

export function installCommunity({app,db,account,limited,games}) {
 db.exec(`
 CREATE TABLE IF NOT EXISTS profiles(account TEXT PRIMARY KEY REFERENCES accounts(id),username TEXT NOT NULL,username_key TEXT NOT NULL UNIQUE,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS community_plays(account TEXT NOT NULL REFERENCES accounts(id),game TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(account,game));
 CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),game TEXT NOT NULL,recommended INTEGER NOT NULL CHECK(recommended IN (0,1)),stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),body TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,hidden INTEGER NOT NULL DEFAULT 0,UNIQUE(account,game));
 CREATE INDEX IF NOT EXISTS reviews_game ON reviews(game,hidden,created DESC);
 CREATE TABLE IF NOT EXISTS review_votes(review TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,account TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(review,account));
 CREATE TABLE IF NOT EXISTS review_comments(id TEXT PRIMARY KEY,review TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,account TEXT NOT NULL REFERENCES accounts(id),body TEXT NOT NULL,created INTEGER NOT NULL,hidden INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS comments_review ON review_comments(review,hidden,created);
 CREATE TABLE IF NOT EXISTS community_reports(kind TEXT NOT NULL,target TEXT NOT NULL,account TEXT NOT NULL REFERENCES accounts(id),reason TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(kind,target,account));`);
 const profile=id=>db.prepare('SELECT username FROM profiles WHERE account=?').get(id)?.username??null;
 const wallet=(req,res,next)=>{req.account=account(req);if(!req.account?.address)return res.status(403).json({error:'Sign in with your wallet to join the community.'});if(limited('community:'+req.account.id,30,60000))return res.status(429).json({error:'Please wait a minute before posting again.'});next();};
 const game=(req,res,next)=>{if(!games.some(g=>g.id===req.params.game))return res.status(404).json({error:'Unknown game'});next();};
 const validText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value);
 const fields=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>keys.includes(k));
 const played=(id,g)=>!!db.prepare('SELECT 1 FROM community_plays WHERE account=? AND game=?').get(id,g);
 const author=(row,id)=>{const {account:owner,...rest}=row;return {...rest,author:profile(owner)||'Player '+owner.slice(0,6),mine:owner===id};};
 const review=id=>db.prepare('SELECT * FROM reviews WHERE id=? AND hidden=0').get(id);
 app.post('/api/profile',wallet,(req,res)=>{
  const name=typeof req.body?.username==='string'?req.body.username.trim():null;
  if(!fields(req.body,['username'])||typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_]{2,23}$/.test(name)||/^(admin|administrator|moderator|support|utxoplay|myelin|steam|epic)$/i.test(name))return res.status(400).json({error:'Use 3–24 letters, numbers or underscores. Official names are reserved.'});
  try{db.prepare('INSERT INTO profiles VALUES(?,?,?,?) ON CONFLICT(account) DO UPDATE SET username=excluded.username,username_key=excluded.username_key,updated=excluded.updated').run(req.account.id,name,name.toLowerCase(),Date.now());res.json({username:name});}
  catch(e){if(e.code==='ERR_SQLITE_ERROR'&&e.message.includes('UNIQUE'))return res.status(409).json({error:'That username is already taken.'});throw e;}
 });
 const counts=(g,since)=>db.prepare('SELECT count(*) total,coalesce(sum(recommended),0) positive,avg(stars) stars FROM reviews WHERE game=? AND hidden=0 AND created>=?').get(g,since);
 const select=`SELECT r.*,(SELECT count(*) FROM review_votes v WHERE v.review=r.id) helpful,(SELECT count(*) FROM review_comments c WHERE c.review=r.id AND c.hidden=0) comments FROM reviews r`;
 app.get('/api/community/:game',game,(req,res)=>{
  const id=account(req)?.id??'',filter=req.query.filter==='positive'?1:req.query.filter==='negative'?0:null,offset=Math.min(10000,Math.max(0,parseInt(req.query.offset)||0));
  const order=req.query.sort==='helpful'?'helpful DESC,r.created DESC,r.id DESC':'r.created DESC,r.id DESC';
  const rows=db.prepare(`${select} WHERE game=? AND hidden=0 AND (? IS NULL OR recommended=?) ORDER BY ${order} LIMIT 10 OFFSET ?`).all(req.params.game,filter,filter,offset);
  const map=row=>({...author(row,id),recommended:!!row.recommended,voted:!!db.prepare('SELECT 1 FROM review_votes WHERE review=? AND account=?').get(row.id,id)});
  const own=db.prepare(`${select} WHERE game=? AND account=? AND hidden=0`).get(req.params.game,id);
  res.json({overall:counts(req.params.game,0),recent:counts(req.params.game,Date.now()-30*86400000),eligible:played(id,req.params.game),mine:own?map(own):null,reviews:rows.map(map),total:db.prepare('SELECT count(*) n FROM reviews WHERE game=? AND hidden=0 AND (? IS NULL OR recommended=?)').get(req.params.game,filter,filter).n,offset});
 });
 app.post('/api/community/:game/review',wallet,game,(req,res)=>{
  const {recommended,stars,body}=req.body??{};
  if(!fields(req.body,['recommended','stars','body'])||typeof recommended!=='boolean'||!Number.isInteger(stars)||stars<1||stars>5||!validText(body,10,3000))return res.status(400).json({error:'Choose a recommendation, 1–5 stars and write 10–3,000 characters.'});
  if(!played(req.account.id,req.params.game))return res.status(403).json({error:'Play this game with this wallet before reviewing it. A saved game action is required.'});
  const old=db.prepare('SELECT hidden FROM reviews WHERE account=? AND game=?').get(req.account.id,req.params.game);
  if(old?.hidden)return res.status(403).json({error:'This review is under moderation.'});
  const now=Date.now();db.prepare('INSERT INTO reviews(id,account,game,recommended,stars,body,created,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account,game) DO UPDATE SET recommended=excluded.recommended,stars=excluded.stars,body=excluded.body,updated=excluded.updated').run(randomUUID(),req.account.id,req.params.game,+recommended,stars,body.trim(),now,now);
  res.json({ok:true});
 });
 app.post('/api/community/:game/review/delete',wallet,game,(req,res)=>{db.prepare('DELETE FROM reviews WHERE game=? AND account=? AND hidden=0').run(req.params.game,req.account.id);res.json({ok:true});});
 app.post('/api/reviews/:id/helpful',wallet,(req,res)=>{
  const row=review(req.params.id);if(!row)return res.status(404).json({error:'Review not found'});
  if(row.account===req.account.id)return res.status(400).json({error:'You cannot vote on your own review.'});
  if(!fields(req.body,['helpful'])||typeof req.body.helpful!=='boolean')return res.status(400).json({error:'Choose whether this review was helpful.'});
  if(req.body.helpful)db.prepare('INSERT OR IGNORE INTO review_votes VALUES(?,?)').run(row.id,req.account.id);else db.prepare('DELETE FROM review_votes WHERE review=? AND account=?').run(row.id,req.account.id);
  res.json({ok:true});
 });
 app.get('/api/reviews/:id/comments',(req,res)=>{
  if(!review(req.params.id))return res.status(404).json({error:'Review not found'});
  const id=account(req)?.id??'',offset=Math.min(10000,Math.max(0,parseInt(req.query.offset)||0));
  res.json({comments:db.prepare('SELECT * FROM review_comments WHERE review=? AND hidden=0 ORDER BY created,id LIMIT 20 OFFSET ?').all(req.params.id,offset).map(r=>author(r,id)),total:db.prepare('SELECT count(*) n FROM review_comments WHERE review=? AND hidden=0').get(req.params.id).n});
 });
 app.post('/api/reviews/:id/comments',wallet,(req,res)=>{
  if(!review(req.params.id))return res.status(404).json({error:'Review not found'});
  if(!fields(req.body,['body'])||!validText(req.body.body,2,1000))return res.status(400).json({error:'Write 2–1,000 characters.'});
  db.prepare('INSERT INTO review_comments(id,review,account,body,created) VALUES(?,?,?,?,?)').run(randomUUID(),req.params.id,req.account.id,req.body.body.trim(),Date.now());res.status(201).json({ok:true});
 });
 app.post('/api/comments/:id/delete',wallet,(req,res)=>{db.prepare('DELETE FROM review_comments WHERE id=? AND account=? AND hidden=0').run(req.params.id,req.account.id);res.json({ok:true});});
 app.post('/api/community-report',wallet,(req,res)=>{
  const {kind,target,reason}=req.body??{};
  if(!fields(req.body,['kind','target','reason'])||!['review','comment'].includes(kind)||typeof target!=='string'||!validText(reason,4,300))return res.status(400).json({error:'Include a short reason for your report.'});
  const table=kind==='review'?'reviews':'review_comments';
  if(!db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND hidden=0`).get(target))return res.status(404).json({error:'Post not found'});
  db.prepare('INSERT OR IGNORE INTO community_reports VALUES(?,?,?,?,?)').run(kind,target,req.account.id,reason.trim(),Date.now());res.json({ok:true});
 });
 return {profile,recordPlay:(id,g)=>db.prepare('INSERT INTO community_plays VALUES(?,?,?) ON CONFLICT(account,game) DO UPDATE SET updated=excluded.updated').run(id,g,Date.now())};
}
