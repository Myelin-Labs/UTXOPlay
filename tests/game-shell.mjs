// Optional DOM integration: ARCADE_TEST_MODULES=/tmp/utxoplay-render-check/node_modules node tests/game-shell.mjs
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(process.env.ARCADE_TEST_MODULES ? resolve(process.env.ARCADE_TEST_MODULES,'../package.json') : import.meta.url);
const {JSDOM} = require('jsdom');
const games = JSON.parse(readFileSync('server/catalog.json'));
const shell = readFileSync('public/game-shell.js','utf8');
for (const {id} of games) {
  const dom = new JSDOM(readFileSync(`games/${id}/web/index.html`,'utf8'),{url:`http://localhost/games/${id}/`,runScripts:'outside-only',pretendToBeVisual:true});
  const {window:w}=dom,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const originalIds=[...d.querySelectorAll('[id]')].map(n=>n.id);
  const controls=[...d.querySelectorAll('button,input,select,summary,a')].filter(n=>!n.closest('header'));
  let blurs=0,gameKeys=0;
  w.addEventListener('blur',()=>blurs++);
  w.addEventListener('keydown',()=>gameKeys++);
  if(id==='neon-miner'){
    const surface=d.querySelector('.game-surface');assert.ok(surface);for(const control of controls)assert.ok(surface.contains(control));assert.ok(surface.querySelector('.game-myelin-badge img'));assert.ok(surface.querySelector('#game-menu'));assert.ok(!d.querySelector('script[src*="game-shell"]'));console.log('neon-miner: native game-owned viewport; interactive behavior covered by miner-flow.mjs');dom.window.close();continue;
  }
  const loader=d.createElement('utxo-loader');d.body.append(loader);
  w.eval(shell);
  assert.ok(loader.isConnected,`${id}: standalone loading screen survives shell mounting`);
  const surface=d.querySelector('.game-surface');
  assert.ok(surface,`${id}: owns a viewport`);
  for(const name of originalIds)assert.ok(d.getElementById(name),`${id}: preserved #${name}`);
  for(const control of controls)assert.ok(surface.contains(control),`${id}: ${control.outerHTML} remains in the game`);
  for(const control of d.querySelectorAll('button,input,select,summary,a'))assert.ok(surface.contains(control),`${id}: no external controls`);
  assert.ok(surface.querySelector('.game-myelin-badge img'));
  if(id!=='openstrike'){
    const toggle=d.querySelector('.game-menu-toggle'),menu=d.querySelector('#game-menu');
    toggle.focus();toggle.click();assert.equal(menu.open,true);assert.equal(blurs,1);
    menu.querySelector('[data-view="settings"]').click();assert.equal(menu.dataset.view,'settings');
    assert.equal(menu.querySelector('[data-menu-view="game"]').hidden,true);
    assert.equal(menu.querySelector('[data-menu-view="settings"]').hidden,false);
    menu.querySelector('button').dispatchEvent(new w.KeyboardEvent('keydown',{key:'r',code:'KeyR',bubbles:true}));
    assert.equal(gameKeys,0,'menu keys must not restart/fire/move the game');
    menu.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(menu.open,false);assert.equal(d.activeElement,toggle);
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.open,true);
    const help=menu.querySelector('#credits-open,#help');
    if(help){help.click();assert.equal(menu.open,false,'close menu before opening another dialog');}
    else {menu.querySelector('#restart').click();assert.equal(menu.open,false,'show restart confirmation in the actual game');}
    const native=surface.querySelector('dialog:not(#game-menu)');
    if(native){native.showModal();const before=gameKeys;native.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));assert.equal(gameKeys,before,'help/credits must not fire or jump behind the dialog');native.close();}
    if(id==='sling'){
      d.dispatchEvent(new w.CustomEvent('utxoplay:open-menu',{detail:{view:'items'}}));
      assert.equal(menu.open,true);assert.equal(menu.dataset.view,'items');assert.equal(d.querySelector('#item-store').hidden,false);
      d.dispatchEvent(new w.CustomEvent('utxoplay:close-menu'));assert.equal(menu.open,false);
    }
  }else assert.equal(d.querySelectorAll('.game-menu-toggle').length,0,'reuse the existing FPS menu');
  console.log(`${id}: all controls in viewport, IDs retained, menu/input checks passed`);
  dom.window.close();
}
