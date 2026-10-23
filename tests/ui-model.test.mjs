import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectGames,apiError} from '../src/ui-model.mjs';
const games=JSON.parse(readFileSync(new URL('../server/catalog.json',import.meta.url)));
test('search tolerates case and surrounding spaces while combining genre and play style',()=>{
 assert.deepEqual(selectGames(games,{query:'  SKYward  ',genre:'Arcade',mode:'solo'}).map(g=>g.id),['sling']);
 assert.deepEqual(selectGames(games,{query:'skyward',genre:'Action'}),[]);
 assert.deepEqual(selectGames(games,{query:'skyward',mode:'friends'}),[]);
 assert.deepEqual(selectGames(games,{mode:'solo'}).map(g=>g.id),['openstrike','teeworlds','sling']);
 assert.deepEqual(selectGames(games,{genre:'Strategy',mode:'friends'}).map(g=>g.id),['chess']);
 assert.equal(selectGames(games,{query:'   '}).length,4);
 assert.equal(games.length,4);
});
test('network failures and timeouts have actionable messages, server validation is preserved',()=>{
 assert.match(apiError(new TypeError('Failed to fetch')),/connection/);
 assert.match(apiError(new DOMException('timeout','TimeoutError')),/try again/);
 assert.equal(apiError(new Error('Use an HTTPS URL.')),'Use an HTTPS URL.');
});
test('every bundled game loads the shared ready/immersion shell with the current cache key',()=>{
 for(const game of games){const html=readFileSync(new URL(`../games/${game.id}/web/index.html`,import.meta.url),'utf8');assert.match(html,/\/game-shell\.js\?v=0\.4\.0/);}
});
