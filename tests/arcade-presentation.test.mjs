import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,kinds} from '../games/arcade/web/engine.mjs';
import {InputBuffer,BoardGesture,feedback,EffectPool,lerp,runSummary} from '../games/arcade/web/presentation.mjs';

test('rapid snake turns survive key release and execute on separate movement ticks',()=>{
 const game=createGame('neon-coil'),input=new InputBuffer(game.kind);
 input.press('w',4,game);input.release('w');input.press('a',1,game);input.release('a');
 for(let i=0;i<6;i++){const before=structuredClone(game);step(game,input.read(game));input.stepped(before,game);}
 assert.deepEqual(game.trail[0],[10,11]);assert.deepEqual(input.queue,[1]);
 for(let i=0;i<6;i++){const before=structuredClone(game);step(game,input.read(game));input.stepped(before,game);}
 assert.deepEqual(game.trail[0],[9,11]);assert.equal(input.queue.length,0);
});
test('snake ignores reversal and repeat presses; pause clears pending input',()=>{
 const game=createGame('neon-coil'),input=new InputBuffer(game.kind);
 input.press('a',1,game);assert.equal(input.read(game),0);input.press('w',4,game);input.press('w',4,game);assert.deepEqual(input.queue,[4]);input.clear();assert.equal(input.read(game),0);
});
test('runner tap is one lane change and a second tap waits through cooldown',()=>{
 const game=createGame('drift-run'),input=new InputBuffer(game.kind);
 input.press('a',1,game);step(game,input.read(game));assert.equal(game.x,0);
 input.release('a');input.pulse(2,game);
 for(let i=0;i<7;i++)step(game,input.read(game));assert.equal(game.x,1);
 for(let i=0;i<15;i++)step(game,input.read(game));assert.equal(game.x,1);
});
test('releasing one control does not release another input source',()=>{
 const game=createGame('starfall'),input=new InputBuffer(game.kind);
 input.press('key',1,game);input.press('touch1',1,game);input.press('fire',16,game);
 input.release('touch1');assert.equal(input.read(game),17);input.clear();assert.equal(input.read(game),0);
});
test('collision effects follow the brick and pickup, not the screen centre',()=>{
 const a=createGame('prism-breaker');a.cells[0]=1;a.bodies[0]={x:71,y:90,vx:0,vy:10,tag:0};const b=structuredClone(a);step(b,0);
 assert.deepEqual(feedback(a,b).find(e=>e.type==='brick'),{type:'brick',x:71,y:115,value:10});
 const s=createGame('neon-coil');s.tick=5;s.x=11;s.y=12;const t=structuredClone(s);step(t,0);
 assert.deepEqual(feedback(s,t)[0],{type:'collect',x:575,y:625,value:10});
});
test('effects have bounded memory and identical travel/lifetime at 30 and 120 Hz',()=>{
 const a=new EffectPool(30),b=new EffectPool(30),event={type:'brick',x:50,y:100};a.emit(event);b.emit(event);
 for(let i=0;i<6;i++)a.advance(1/30);for(let i=0;i<24;i++)b.advance(1/120);
 assert.equal(a.items.length,b.items.length);a.items.forEach((p,i)=>{assert.ok(Math.abs(p.x-b.items[i].x)<1e-9);assert.ok(Math.abs(p.y-b.items[i].y)<1e-9);});
 for(let i=0;i<100;i++)a.emit(event);assert.equal(a.items.length,30);a.advance(1);assert.equal(a.items.length,0);
 const reduced=new EffectPool();reduced.emit(event,true);assert.equal(reduced.items.length,0);
});
test('feedback and interpolation cannot alter deterministic state or emit on a resync',()=>{
 for(const kind of kinds){const game=createGame(kind),before=structuredClone(game);step(game,16);const snapshot=JSON.stringify(game);feedback(before,game);assert.equal(JSON.stringify(game),snapshot);assert.deepEqual(feedback(before,{...game,tick:game.tick+10}),[]);}
 assert.equal(lerp(100,130,.5),115);assert.equal(lerp(100,130,2),130);
});

test('long racing swipe changes only one lane until the next gesture',()=>{
 const gesture=new BoardGesture('drift-run');gesture.begin(1,100,100,1);
 assert.equal(gesture.move(1,140,100),0);assert.equal(gesture.move(1,150,100),2);
 assert.equal(gesture.move(1,400,100),0);assert.equal(gesture.move(1,20,100),0);
 gesture.end(1);gesture.begin(2,400,100,2);assert.equal(gesture.move(2,300,100),1);
});
test('vertical racing swipe and diagonal jitter cannot switch a lane',()=>{
 const gesture=new BoardGesture('drift-run');gesture.begin(1,100,100,1);
 assert.equal(gesture.move(1,120,160),0);assert.equal(gesture.move(1,400,200),0);
});
test('touch drag has no initial steering jump and another finger cannot steal it',()=>{
 const gesture=new BoardGesture('prism-breaker');assert.equal(gesture.begin(1,100,900,500),true);assert.equal(gesture.target,500);
 assert.equal(gesture.begin(2,800,900,500),false);gesture.move(2,900,900);gesture.end(2);assert.equal(gesture.owner,1);assert.equal(gesture.target,500);
 gesture.move(1,150,900);assert.equal(gesture.target,550);gesture.move(1,900,900);assert.equal(gesture.target,1000);
 gesture.end(1);assert.equal(gesture.owner,null);assert.equal(gesture.target,null);
});
test('snake swipe commits one turn; cancellation clears the owner',()=>{
 const gesture=new BoardGesture('neon-coil');gesture.begin(3,100,200,0);
 assert.equal(gesture.move(3,105,140),4);assert.equal(gesture.move(3,300,140),0);
 gesture.clear();assert.equal(gesture.move(3,105,280),0);assert.equal(gesture.target,null);
});
test('run summary distinguishes ties, records and time-limit completion',()=>{
 const game={...createGame('starfall'),score:120,tick:1870,over:true};
 assert.equal(runSummary(game,120).title,'One more run?');assert.equal(runSummary(game,100).title,'New device best!');assert.equal(runSummary(game,120).duration,'1:02');
 assert.equal(runSummary({...game,tick:18000},120).title,'Ten minutes complete!');
});
