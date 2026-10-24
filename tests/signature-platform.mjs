// Isolated native executors and store; never touches existing saves.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),data=mkdtempSync('/tmp/utxoplay-signatures-'),token=randomBytes(32).toString('hex'),env={...process.env,BIND:'127.0.0.1',RUNTIME_TOKEN:token},children=[];
for(const [name,port,bin] of [['arcade',19131,'myelin-arcade'],['prism',19132,'myelin-prism-breaker']])children.push(spawn(path.join(root,'artifacts/portable-build/target/debug',bin),[],{cwd:root,env:{...env,PORT:String(port),DATA_DIR:path.join(data,name)},stdio:'inherit'}));
children.push(spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...env,PORT:'19130',PUBLIC_ORIGIN:'http://127.0.0.1:19130',PRISM_URL:'http://127.0.0.1:19132',ARCADE_URL:'http://127.0.0.1:19131',DATA_DIR:path.join(data,'store')},stdio:'inherit'}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const child of children)child.kill();setTimeout(()=>process.exit(),200);});
console.log('Signature gameplay validation: http://127.0.0.1:19130/');
