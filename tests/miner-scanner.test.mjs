import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,apply} from '../games/neon-miner/web/engine.mjs';
import {scan} from '../games/neon-miner/web/scanner.mjs';

test('prospecting forecast matches discrete first contact at all angles in all 20 sectors',()=>{
  const campaign=createGame();
  for(let sector=1;sector<=20;sector++){
    for(let angle=0;angle<=70;angle++){
      const g=structuredClone(campaign);g.angle=angle;
      const before=structuredClone(g),forecast=scan(g);
      assert.deepEqual(g,before,'scanning is read-only');
      step(g,1);while(g.phase===1)step(g,0);
      assert.equal(g.cargo,forecast.ore?before.ores.findIndex(o=>o.x===forecast.ore.x&&o.y===forecast.ore.y):-1,`sector ${sector}, angle ${angle}`);
    }
    if(sector<20){campaign.mode='cleared';apply(campaign,{type:'next'});}
  }
});

test('scan skips removed targets and applies the existing lens valuation',()=>{
  const g=createGame();g.ores=[{x:500,y:260,radius:21,kind:2,value:260,weight:1,taken:false}];g.lens=3;
  assert.equal(scan(g).value,416);
  g.ores[0].taken=true;assert.equal(scan(g).ore,null);
});
