import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectGames,apiError} from '../src/ui-model.mjs';
const games=JSON.parse(readFileSync(new URL('../server/catalog.json',import.meta.url)));
test('search tolerates case and surrounding spaces while combining genre and play style',()=>{
 assert.deepEqual(selectGames(games,{query:'  SKYward  ',genre:'Arcade',mode:'solo'}).map(g=>g.id),['sling']);
 assert.deepEqual(selectGames(games,{query:'skyward',genre:'Action'}),[]);
 assert.deepEqual(selectGames(games,{query:'skyward',mode:'friends'}),[]);
 assert.deepEqual(selectGames(games,{mode:'solo'}).map(g=>g.id),['neon-miner','prism-breaker','neon-coil','starfall','drift-run','openstrike','teeworlds','sling','rune-foundry','lumen-weave','orbit-courier','mosslight']);
 assert.deepEqual(selectGames(games,{genre:'Strategy',mode:'friends'}).map(g=>g.id),['chess']);
 assert.equal(selectGames(games,{query:'   '}).length,13);
 assert.equal(games.length,13);
});
test('network failures and timeouts have actionable messages, server validation is preserved',()=>{
 assert.match(apiError(new TypeError('Failed to fetch')),/connection/);
 assert.match(apiError(new DOMException('timeout','TimeoutError')),/try again/);
 assert.equal(apiError(new Error('Use an HTTPS URL.')),'Use an HTTPS URL.');
});
test('every bundled game owns its viewport and loads its current interface',()=>{
 for(const game of games){const html=readFileSync(new URL(`../games/${game.id}/web/index.html`,import.meta.url),'utf8');if(game.id==='neon-miner'){assert.match(html,/data-surface="miner"/);assert.match(html,/id="game-menu"/);assert.match(html,/app\.mjs\?v=0\.16\.0/);}else if(game.runtime==='atelier'){assert.match(html,/data-surface="atelier"/);assert.match(html,/id="game-menu"/);assert.match(html,/\/atelier\/app\.mjs/);}else assert.match(html,/\/game-shell\.js\?v=0\.14\.0/);}
});

test('wallet button distinguishes authentication phases and never treats a selected signer as login',async()=>{
 const {walletButtonState:state}=await import('../src/ui-model.mjs');
 assert.equal(state({}).state,'disconnected');assert.equal(state({user:{guest:true}}).label,'Connect wallet');
 assert.equal(state({signer:{}}).state,'ready');assert.equal(state({loadingUser:true}).state,'checking');
 for(const phase of ['loading','signature','verifying','logout']){const view=state({walletBusy:true,walletPhase:phase});assert.equal(view.state,phase);assert.equal(view.busy,true);}
 assert.equal(state({isOpen:true}).state,'choosing');assert.equal(state({walletError:'Rejected'}).state,'error');
 const signed=state({user:{guest:false,address:'ckb1abcdefghijklmnopqrstuvwxyz'}});assert.equal(signed.state,'connected');assert.match(signed.label,/^ckb1ab…wxyz$/);assert.equal(signed.busy,false);
});
