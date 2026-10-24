import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,step,enclosedArea} from '../games/arcade/web/engine.mjs';
import {createPrism,prismStep} from '../games/arcade/web/prism-engine.mjs';
const body=(x,y,tag,vx=0,vy=0)=>({x,y,tag,vx,vy});
test('Coil closes a real enclosure, burns its loop and rewards area; short knots still kill',()=>{
 const g=createGame('neon-coil');g.trail=[[3,2],[3,1],[2,1],[1,1],[1,2],[1,3],[2,3],[3,3],[4,3]];g.tick=5;g.dir=g.next_dir=2;g.x=g.y=10;
 step(g,8);assert.equal(g.over,false);assert.equal(g.specials,1);assert.equal(g.loop_area,1);assert.equal(g.score,50);assert.equal(g.trail.length,3);assert.deepEqual(g.trail[0],[3,3]);assert.equal(g.ability_ticks,45);
 assert.equal(enclosedArea([[1,1],[2,1],[3,1]]),0);
 const knot=createGame('neon-coil');knot.trail=[[2,2],[2,1],[1,1],[1,2],[1,3]];knot.tick=5;knot.dir=knot.next_dir=3;step(knot,1);assert.equal(knot.over,true);assert.equal(knot.specials,0);
});
test('Starfall must stop firing to capture; release converts stored bullets to a finite fan',()=>{
 const g=createGame('starfall');g.vy=0;g.bodies=[body(100,100,1),body(500,820,3,0,10)];
 step(g,20);assert.equal(g.energy,1);assert.equal(g.lives,3);assert.ok(!g.bodies.some(b=>b.tag===2||b.tag===3));
 step(g,0);assert.equal(g.energy,0);assert.equal(g.specials,1);assert.equal(g.bodies.filter(b=>b.tag===4).length,1);
 const count=g.specials;step(g,0);assert.equal(g.specials,count);
 const hot=createGame('starfall');for(let i=0;i<46;i++)step(hot,4);assert.equal(hot.ability_ticks,0);assert.equal(hot.ability_lock,60);
});
test('Reflected fire rewards accurate return fire and still obeys collisions',()=>{const g=createGame('starfall');g.bodies=[body(500,400,1),body(500,424,4,0,-24)];step(g,0);assert.equal(g.score,240);assert.equal(g.level,2);});
test('Drift lane echoes harvest abandoned rings; close passes charge once and burst costs three',()=>{
 const echo=createGame('drift-run');echo.bodies=[body(1,810,2)];step(echo,2);assert.equal(echo.x,2);assert.equal(echo.echo_lane,1);assert.equal(echo.score,40);assert.equal(echo.energy,1);
 const g=createGame('drift-run');g.bodies=[body(0,825,1)];step(g,0);assert.equal(g.energy,1);step(g,0);assert.equal(g.energy,1);assert.equal(g.combo,1);
 g.energy=3;g.bodies=[body(g.x,800,1)];step(g,16);assert.equal(g.over,false);assert.equal(g.energy,0);assert.equal(g.ability_ticks,45);assert.equal(g.specials,1);assert.ok(!g.bodies.some(b=>b.x===g.x&&b.y>700));
 g.energy=3;for(let i=0;i<46;i++){g.bodies=[];step(g,16);}assert.equal(g.specials,1,'holding cannot repeatedly spend a newly filled meter');
});
test('Prism refraction chooses a side, reverses a falling orb and cannot auto-repeat or overspend',()=>{
 const g=createPrism();g.bodies=[body(500,450,0,7,12)];prismStep(g,4);assert.equal(g.refraction,0);assert.equal(g.bodies[0].vx,-12);assert.equal(g.bodies[0].vy,-12);assert.equal(g.refractions,1);
 g.refraction=6;prismStep(g,4);assert.equal(g.refractions,1);prismStep(g,0);prismStep(g,8);assert.equal(g.refractions,2);assert.equal(g.refract_dir,1);assert.ok(g.bodies[0].vx>0);assert.equal(g.refraction,2);
 prismStep(g,0);prismStep(g,4);assert.equal(g.refractions,2);
});

// A UI click can begin and end between two 30 Hz simulation frames.
import {InputBuffer} from '../games/arcade/web/presentation.mjs';
test('fast ability taps survive pointer release but pause clears them; held burst coexists with lane taps',()=>{
 for(const [kind,bit] of [['prism-breaker',4],['prism-breaker',8],['drift-run',16]]){const g=createGame(kind),input=new InputBuffer(kind);input.press('touch',bit,g);input.release('touch');assert.equal(input.read(g),bit);assert.equal(input.read(g),0);input.press('touch',bit,g);input.clear();assert.equal(input.read(g),0);}
 const g=createGame('drift-run'),input=new InputBuffer(g.kind);input.press('burst',16,g);input.press('left',1,g);assert.equal(input.read(g),17);g.cooldown=5;assert.equal(input.read(g),16);input.release('burst');assert.equal(input.read(g),0);
});
