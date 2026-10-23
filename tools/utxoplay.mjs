#!/usr/bin/env node
import {readFileSync} from 'node:fs';
const [command,file]=process.argv.slice(2);
if(command!=='check'||!file){console.error('Usage: node tools/utxoplay.mjs check manifest.json');process.exit(1);}
try{const m=JSON.parse(readFileSync(file,'utf8'));if(typeof m.name!=='string'||m.name.length<3||m.name.length>80)throw Error('name must be 3–80 characters');if(!/^\d+\.\d+\.\d+$/.test(m.version))throw Error('version must use major.minor.patch');if(new URL(m.entrypoint).protocol!=='https:')throw Error('entrypoint must use HTTPS');if(!['arcade','strategy','puzzle','action','other'].includes(m.genre))throw Error('unsupported genre');if(!['browser','myelin'].includes(m.runtime))throw Error('runtime must be browser or myelin');console.log('Manifest valid: '+m.name+' '+m.version);}catch(e){console.error(e.message);process.exit(1);}
