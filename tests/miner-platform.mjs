// Isolated local validation host; does not use production data or credentials.
import {spawn} from 'node:child_process';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomBytes} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),data=mkdtempSync(path.join(tmpdir(),'miner-platform-')),token=randomBytes(32).toString('hex');
const children=[];const common={...process.env,RUNTIME_TOKEN:token,BIND:'127.0.0.1'};
children.push(spawn(process.env.MINER_BIN||path.join(root,'games/neon-miner/target/debug/myelin-neon-miner'),[],{cwd:root,env:{...common,PORT:'19096',DATA_DIR:path.join(data,'miner')},stdio:'inherit'}));
children.push(spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...common,PORT:'19091',PUBLIC_ORIGIN:'http://127.0.0.1:19091',MINER_URL:'http://127.0.0.1:19096',DATA_DIR:path.join(data,'platform')},stdio:'inherit'}));
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{for(const child of children)child.kill();setTimeout(()=>process.exit(),250);});
console.log('Miner validation at http://127.0.0.1:19091/games/neon-miner/');
