// Presentation for every game-owned menu. Existing action nodes and handlers stay intact.
(() => {
  function mount() {
    const surface=document.querySelector('.game-surface');if(!surface)return;
    const id=document.documentElement.dataset.game||location.pathname.split('/').filter(Boolean)[1];
    const themes={
      'prism-breaker':['Prism Breaker','REFRACTION LAB','192 166 246','/games/prism-breaker/art/sanctum.webp'],
      'neon-miner':['Neon Prospector','UNDERCITY OPERATIONS','240 192 112','/assets/neon-miner-cover.webp'],
      'neon-coil':['Neon Coil','LIVING CIRCUIT','136 233 183','/assets/neon-coil-keyart.webp'],
      starfall:['Starfall','ORBITAL COMMAND','133 211 244','/assets/starfall-keyart.webp'],
      'drift-run':['Drift Run','AFTER HOURS','244 172 132','/assets/drift-run-keyart.webp'],
      sling:['Skyward','THE FLOATING GARDENS','237 205 145','/assets/sling-cover.webp?v=0.22.0'],
      chess:['The Quiet Board','THE BLUE HOUR CLUB','233 207 157','/assets/chess-cover.webp?v=0.21.0'],
      teeworlds:['Teeworlds','GRASSLAND ARENA','192 221 135','/assets/teeworlds-cover.svg'],
      openstrike:['OpenStrike','SUNLIT HARBOR','155 220 198','/games/openstrike/art/harbor-keyart.webp']
    };
    const theme=themes[id];if(!theme)return;
    surface.dataset.menuTheme=id;
    const quality=()=>{try{surface.dataset.menuQuality=localStorage.getItem('utxoplay:quality')||'auto';}catch{surface.dataset.menuQuality='auto';}};quality();window.addEventListener('utxoplay:quality',quality);window.addEventListener('storage',quality);
    surface.style.setProperty('--menu-accent',theme[2]);surface.style.setProperty('--menu-art',`url("${theme[3]}")`);
    const fps=id==='openstrike',miner=id==='neon-miner';
    const menu=document.querySelector(fps?'#panel':'#game-menu');if(!menu||menu.dataset.overlayMounted)return;menu.dataset.overlayMounted='true';
    menu.classList.add('immersive-menu');
    if(!fps){const reflect=()=>{surface.dataset.menuOpen=String(menu.open);};new MutationObserver(reflect).observe(menu,{attributes:true,attributeFilter:['open']});reflect();}
    let content=menu.querySelector('.game-menu-content');
    if(!content){content=document.createElement('div');content.className='game-menu-content';content.append(...menu.childNodes);menu.append(content);}
    let heading=content.querySelector('.game-menu-heading,.dialog-head');
    if(!heading){heading=document.createElement('header');heading.innerHTML='<div><span class="overlay-eyebrow"></span><h2></h2></div>';content.prepend(heading);}
    heading.classList.add('game-menu-heading');
    const title=heading.querySelector('h2');
    if(!miner)title.textContent=theme[0];
    let eyebrow=heading.querySelector('.overlay-eyebrow,.eyebrow');
    if(!eyebrow){eyebrow=document.createElement('span');eyebrow.className='overlay-eyebrow';const group=document.createElement('div');title.before(group);group.append(eyebrow,title);}
    eyebrow.textContent=miner?theme[0].toUpperCase():theme[1];
    const close=heading.querySelector('button');
    if(close){close.classList.add('overlay-return');if(!miner)close.innerHTML='<span>Return to game</span><kbd>ESC</kbd>';else{close.setAttribute('aria-label','Return to game');close.innerHTML='<span>Return</span><kbd>ESC</kbd>';}}
    let nav=content.querySelector('.game-menu-sections,nav');
    if(nav){nav.classList.add('game-menu-sections');const paths=['M7 4 18 12 7 20Z','M4 8h16v12H4zM8 8V6a4 4 0 0 1 8 0v2','M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6','M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01'];
      for(const [i,button]of [...nav.children].entries()){const label=button.textContent;const key=button.dataset.view||button.dataset.tab;const path=paths[key==='items'?1:key==='settings'?2:key==='help'?3:0];button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span><small aria-hidden="true">${String(i+1).padStart(2,'0')}</small>`;}
    }
    const sections=content.querySelectorAll('[data-menu-view],div[data-view]');
    for(const section of sections){section.classList.add('overlay-view');}
    const gameView=content.querySelector('[data-menu-view="game"],div[data-view="game"]');
    if(gameView){
      const lines={
        'prism-breaker':['Find your angle.','24 crystal sectors · Power-ups & permanent perks'],
        'neon-miner':['Back to the undercity.','60 sectors · Build your rig · Earn every upgrade'],
        'neon-coil':['Stay in the circuit.','One more turn. One longer run.'],
        starfall:['Clear the next wave.','Keep moving. Find a gap.'],
        'drift-run':['Own the night.','Three lanes. Keep your rhythm.'],
        sling:['The sky is yours.','Twelve islands · Choose your next flight'],
        chess:['Make your next move.','Your board. Your pace.'],
        teeworlds:['Hook into the action.','Live rounds continue while this overlay is open.']
      };
      const card=document.createElement('div');card.className='overlay-session-art';
      const kicker=document.createElement('span'),headline=document.createElement('h3'),detail=document.createElement('p');
      kicker.textContent=theme[1];headline.textContent=lines[id][0];detail.textContent=lines[id][1];card.append(kicker,headline,detail);gameView.prepend(card);
    }
    if(fps){
      menu.setAttribute('role','dialog');menu.setAttribute('aria-label','OpenStrike game menu');menu.setAttribute('aria-modal','true');
      const main=document.createElement('section');main.className='overlay-view fps-session';
      for(const node of [...content.children])if(node!==heading&&!node.classList.contains('game-system-actions'))main.append(node);
      content.append(main);
      const instructions=main.querySelector('details');
      if(instructions){instructions.open=true;const side=document.createElement('section');side.className='fps-settings';side.append(instructions);const quality=main.querySelector('.game-quality');if(quality)side.append(quality);content.append(side);}
      // The engine owns visibility and pointer lock. Only visible menu input is trapped.
      const focusables=()=>[...menu.querySelectorAll('button,a,input,select,summary')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length);
      let wasHidden=menu.hidden;
      function sync(){
        for(const sibling of surface.children)if(sibling!==menu)sibling.inert=!menu.hidden;
        if(wasHidden&&!menu.hidden)focusables()[0]?.focus({preventScroll:true});wasHidden=menu.hidden;
      }
      new MutationObserver(sync).observe(menu,{attributes:true,attributeFilter:['hidden']});document.addEventListener('utxoplay:fps-menu',sync);sync();
      window.addEventListener('keydown',event=>{
        if(menu.hidden)return;
        if(event.key==='Escape'){event.preventDefault();const resume=menu.querySelector('#resume');if(resume&&!resume.closest('[hidden]')&&!resume.disabled)resume.click();}
        if(event.key==='Tab'){const items=focusables(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
        event.stopImmediatePropagation();
      },true);
      window.addEventListener('keyup',event=>{if(!menu.hidden)event.stopImmediatePropagation();},true);
    }
    if(['sling','neon-miner'].includes(id))window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='utxoplay:open-items')return;
      document.dispatchEvent(new CustomEvent('utxoplay:open-menu',{detail:{view:'items'}}));
    });
    const footer=document.createElement('div');footer.className='overlay-footer';
    const live=['openstrike','teeworlds'].includes(id);
    footer.innerHTML=`<span class="overlay-platform"><img src="/brand/utxoplay-logo-dark-192.webp" alt="" width="20" height="20">UTXOPlay <i>/</i> IN-GAME</span><span class="overlay-status${live?' live':''}">${live?'ONLINE PLAY · ROUNDS CONTINUE':'YOUR GAME · YOUR PACE'}</span>`;
    const systemActions=content.querySelector('.game-system-actions');if(systemActions)content.append(systemActions);
    const community=document.createElement('a');community.href='/community/'+id;community.target='_top';community.textContent='Player community ↗';community.className='overlay-community';footer.append(community);
    content.append(footer);
    const opener=surface.querySelector('.game-menu-toggle')||surface.querySelector('#menu');
    if(opener){opener.classList.add('overlay-opener');opener.setAttribute('aria-label','Open game menu');opener.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16"/></svg><span>Menu</span><kbd>ESC</kbd>';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
