import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
const [file,action,kind,id,...words]=process.argv.slice(2);
if(!file||!['list','hide','restore'].includes(action)||action!=='list'&&(!['review','comment'].includes(kind)||!id||!words.join(' ').trim())){
 console.error('Usage: node tools/community-moderate.mjs DATABASE list | hide/restore review/comment ID REASON');process.exit(1);
}
if(!existsSync(file))throw Error('Database does not exist');
const db=new DatabaseSync(file,{readOnly:action==='list'});db.exec('PRAGMA busy_timeout=5000');
try{
 if(action==='list')console.log(JSON.stringify(db.prepare(`SELECT p.*,r.body review_body,r.hidden review_hidden,c.body comment_body,c.hidden comment_hidden FROM community_reports p LEFT JOIN reviews r ON p.kind='review' AND p.target=r.id LEFT JOIN review_comments c ON p.kind='comment' AND p.target=c.id ORDER BY p.created DESC LIMIT 100`).all(),null,2));
 else{
  db.exec('CREATE TABLE IF NOT EXISTS community_moderation(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,target TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL)');
  db.exec('BEGIN IMMEDIATE');
  const result=db.prepare(`UPDATE ${kind==='review'?'reviews':'review_comments'} SET hidden=? WHERE id=?`).run(action==='hide'?1:0,id);
  if(result.changes!==1)throw Error('Post not found');
  db.prepare('INSERT INTO community_moderation(kind,target,action,reason,created) VALUES(?,?,?,?,?)').run(kind,id,action,words.join(' '),Date.now());db.exec('COMMIT');console.log(`${action}: ${kind} ${id}`);
 }
}finally{db.close();}
