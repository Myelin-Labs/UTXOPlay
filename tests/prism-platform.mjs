// Isolated store + native Prism campaign executor. Never uses production data.
import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';import {mkdtempSync} from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),data=mkdtempSync('/tmp/utxoplay-prism-'),token=randomBytes(32).toString('hex'),env={...process.env,BIND:'127.0.0.1',RUNTIME_TOKEN:token},children=[];
children.push(spawn(process.env.PRISM_BIN||path.join(root,'deploy/bin/myelin-prism-breaker'),[],{cwd:root,env:{...env,PORT:'19095',DATA_DIR:path.join(data,'arcade')},stdio:'inherit'}));
children.push(spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...env,PORT:'19090',PUBLIC_ORIGIN:'http://127.0.0.1:19090',PRISM_URL:'http://127.0.0.1:19095',DATA_DIR:path.join(data,'store')},stdio:'inherit'}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const child of children)child.kill();setTimeout(()=>process.exit(),200);});
console.log('Prism campaign validation: http://127.0.0.1:19090/play/prism-breaker');
