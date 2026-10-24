// Local visual fixture only. The production component stays unmodified.
// node tests/loader-preview.mjs -> http://127.0.0.1:19110/
import express from 'express';
const app=express();
app.get('/',(_req,res)=>res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>UTXOPlay loading design preview</title><script src="/game-loader.js"></script><script defer src="/fixture.js"></script></head><body style="margin:0;background:#080e0d"><utxo-loader></utxo-loader></body></html>`));
app.get('/fixture.js',(_req,res)=>res.type('js').send(`document.querySelector('utxo-loader').state={title:'Neon Prospector',cover:'/assets/neon-miner-cover.webp',progress:68,phase:'Loading artwork',detail:'10 / 16 artwork assets ready',steps:[true,false,true,false]};`));
app.use(express.static('dist'));app.listen(19110,'127.0.0.1',()=>console.log('Visual fixture: http://127.0.0.1:19110/'));
