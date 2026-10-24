// Run the local store and all eight runtimes together; never leave an empty game iframe.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const strike=process.env.OPENSTRIKE_ROOT||path.resolve(root,'../myelin-openstrike');
const tee=process.env.TEEWORLDS_ROOT||path.resolve(root,'../myelin-teeworlds');
const specs=[
 ['chess',8781,path.join(root,'deploy/bin/myelin-chess'),[]],
 ['sling',8782,path.join(root,'deploy/bin/myelin-sling'),[]],
 ['openstrike',8784,process.execPath,[path.join(strike,'service/server.mjs')]],
 ['teeworlds',8783,process.execPath,[path.join(tee,'service/server.mjs')]],
 ['miner',8786,path.join(root,'deploy/bin/myelin-neon-miner'),[]],
 ['prism',8787,path.join(root,'deploy/bin/myelin-prism-breaker'),[]],
 ['arcade',8785,path.join(root,'deploy/bin/myelin-arcade'),[]],
 ['atelier',8788,path.join(root,'deploy/bin/myelin-atelier'),[]],
 ['store',8790,process.execPath,[path.join(root,'server/index.mjs')]],
];
for(const file of ['dist/index.html','deploy/bin/myelin-chess','deploy/bin/myelin-sling','deploy/bin/myelin-arcade','deploy/bin/myelin-neon-miner','deploy/bin/myelin-prism-breaker','deploy/bin/myelin-atelier'])if(!existsSync(path.join(root,file)))throw Error(`Missing ${file}. Build the store and game binaries first.`);
if(!existsSync(path.join(tee,'service/server.mjs')))throw Error('Set TEEWORLDS_ROOT to your myelin-teeworlds checkout with its built release artifacts.');
for(const [,port] of specs)await new Promise((resolve,reject)=>{const s=createServer();s.once('error',()=>reject(Error(`Port ${port} is already in use. Stop the existing local platform before starting this command.`)));s.listen(port,'127.0.0.1',()=>s.close(resolve));});
const token=process.env.RUNTIME_TOKEN||randomBytes(32).toString('hex');
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');process.exit(code);},2000).unref();}
for(const [name,port,cmd,args] of specs){
 const dataDir=path.join(root,'data',name==='store'?'':`local-${name}`);mkdirSync(dataDir,{recursive:true});
 const child=spawn(cmd,args,{cwd:root,env:{...process.env,BIND:'127.0.0.1',PORT:String(port),DATA_DIR:dataDir,RUNTIME_TOKEN:token,PUBLIC_ORIGIN:'http://127.0.0.1:8790',CHESS_URL:'http://127.0.0.1:8781',SLING_URL:'http://127.0.0.1:8782',TEEWORLDS_URL:'http://127.0.0.1:8783'},stdio:'inherit'});
 children.push(child);child.on('error',error=>{console.error(`${name}: ${error.message}`);stop(1);});child.on('exit',code=>{if(!stopping){console.error(`${name} exited (${code}); stopping the local platform.`);stop(code||1);}});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
console.log('Local UTXOPlay: http://127.0.0.1:8790 — Ctrl+C stops all nine services.');
