// A single game-owned viewport. Existing game controls keep their nodes and handlers.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const kind = $('#world') ? 'sling' : $('#board') ? 'chess' : $('.arena-wrap') ? 'teeworlds' : $('#panel') ? 'openstrike' : 'arcade';
  let surface = $(kind === 'sling' ? '.game-shell' : kind === 'chess' ? '.table' : kind === 'teeworlds' ? '.arena-wrap' : kind === 'arcade' ? '.board' : 'body');
  if (kind === 'openstrike') {
    surface = document.createElement('section');
    surface.append(...document.body.children);
  }
  surface.classList.add('game-surface');
  surface.dataset.surface = kind;
  document.body.append(surface);
  document.documentElement.classList.add('game-only');
  const move = (selector, destination) => document.querySelectorAll(selector).forEach(node => destination.append(node));
  let menu;
  let opener;
  let previousFocus;
  function closeMenu() {
    if (!menu?.open) return;
    menu.close();
    document.dispatchEvent(new CustomEvent('utxoplay:menu', {detail:{open:false}}));
    (previousFocus?.isConnected ? previousFocus : opener)?.focus();
  }
  if (kind === 'openstrike') {
    menu = $('#panel'); // This game already has its own in-arena menu.
  } else {
    menu = document.createElement('dialog');
    menu.className = 'game-menu';
    menu.id = 'game-menu';
    menu.setAttribute('aria-label', 'Game menu');
    menu.innerHTML = '<div class="game-menu-content"><div class="game-menu-heading"><h2>Game menu</h2><button type="button" class="game-menu-close">Back to game ×</button></div><div class="game-menu-settings"></div></div>';
    surface.append(menu);
    opener = document.createElement('button');
    opener.className = 'game-menu-toggle';
    opener.textContent = '☰ Menu';
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.setAttribute('aria-controls', menu.id);
    surface.append(opener);
    const openMenu = (view = 'game') => {
      if (menu.open || $('dialog[open]')) return;
      previousFocus = document.activeElement;
      // Use the games' existing blur handlers to clear held inputs and pause solo runs.
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new CustomEvent('utxoplay:menu', {detail:{open:true}}));
      document.dispatchEvent(new CustomEvent('utxoplay:menu-view', {detail:{view}}));
      menu.showModal();
      menu.querySelector('.game-menu-close').focus();
    };
    opener.onclick = () => openMenu();
    document.addEventListener('utxoplay:open-menu', event => openMenu(event.detail?.view || 'game'));
    document.addEventListener('utxoplay:close-menu', closeMenu);
    menu.querySelector('.game-menu-close').onclick = closeMenu;
    menu.addEventListener('cancel', event => {event.preventDefault();closeMenu();});
    window.addEventListener('keydown', event => {
      const activeDialog = $('dialog[open]');
      if (!activeDialog) return;
      if (activeDialog !== menu) {event.stopImmediatePropagation();return;}
      if (event.key === 'Escape') {event.preventDefault();closeMenu();}
      // Native dialog handles Tab/Enter; game-wide hotkeys must not receive menu input.
      event.stopImmediatePropagation();
    }, true);
    window.addEventListener('keyup', event => {if($('dialog[open]'))event.stopImmediatePropagation();}, true);
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('dialog[open]')) {event.preventDefault();openMenu();}
    });
    menu.addEventListener('click', event => {
      if(event.target.closest('#launch,#pause,#restart,#replay-shot,#help-open,#credits-open,#help') || (kind !== 'sling' && event.target.closest('#new')))closeMenu();
    }, true);
    const settings = menu.querySelector('.game-menu-settings');
    move('body > header button, body > .topbar button', settings);
    if (kind === 'arcade') {
      move('.hud,.touch,#announcement', surface);
      move('.toolbar,.play-tools,.session-line,.panel', settings);
    } else if (kind === 'sling') {
      move('.satchel', surface);
      move('#launch', $('.item-buttons'));
      move('#extra-flight', $('#extra-use-slot'));
      move('#item-store', menu.querySelector('.game-menu-content'));
      move('#flight-status', surface);
      move('#targets-left', $('.hud'));
      move('#region,.stage-footer,.flight-feedback,.journey,.under-game,.bottom-grid,.evidence', settings);
    } else if (kind === 'chess') {
      move('#status', surface);
      move('.play-layout > aside,.evidence', settings);
    } else {
      move('.below,.footnote', settings);
      const note = document.createElement('p');
      note.textContent = 'Live rounds continue while this menu is open.';
      settings.prepend(note);
    }
    move('body > dialog,body > #toast,body > #notice', surface);
    // Remove obsolete site furniture, after preserving every functional game node.
    for (const node of [...document.body.children]) {
      if (node !== surface && !['SCRIPT','STYLE','LINK','UTXO-LOADER'].includes(node.tagName)) node.remove();
    }
  }
  if (!$('#quality')) {
    const quality = document.createElement('label');
    quality.className = 'game-quality';
    quality.textContent = 'Visual quality ';
    const select = document.createElement('select');
    select.setAttribute('aria-label','Visual quality');
    for (const [value,label] of [['auto','Auto'],['high','High'],['low','Low power']]) {
      const option = document.createElement('option');option.value=value;option.textContent=label;select.append(option);
    }
    try {select.value=localStorage.getItem('utxoplay:quality') || 'auto';} catch {}
    select.onchange=()=>{
      try {localStorage.setItem('utxoplay:quality',select.value);} catch {}
      window.dispatchEvent(new Event('utxoplay:quality'));
    };
    quality.append(select);
    (menu.querySelector('.game-menu-settings') || menu).append(quality);
  }
  if(kind !== 'openstrike') {
    const content = menu.querySelector('.game-menu-content');
    const gameView = menu.querySelector('.game-menu-settings');
    gameView.dataset.menuView = 'game';
    const views = {game:gameView};
    for (const name of ['settings','help']) {
      const view = document.createElement('section');view.className = 'game-menu-settings';view.dataset.menuView = name;view.hidden = true;
      content.append(view);views[name] = view;
    }
    const moveControl = (selector, target) => document.querySelectorAll(selector).forEach(node => target.append(node));
    moveControl('#sound,.game-quality,.quality-label,.flight-feedback', views.settings);
    moveControl('#credits-open,.field-notes,.evidence,#help-open', views.help);
    if(kind === 'arcade')moveControl('.panel',views.help);
    if(kind === 'teeworlds')moveControl('#help,.below,.footnote',views.help);
    if(kind === 'sling') {views.items = $('#item-store');views.items.dataset.menuView = 'items';}
    const navigation = document.createElement('nav');navigation.className = 'game-menu-sections';navigation.setAttribute('aria-label','Game menu sections');
    const names = {game:'Game',items:'Item Store',settings:'Settings',help:'Help & credits'};
    function selectView(name) {
      if(!views[name])name='game';
      for(const [key,view] of Object.entries(views))view.hidden=key!==name;
      for(const button of navigation.children)button.setAttribute('aria-pressed',String(button.dataset.view===name));
      menu.dataset.view=name;
    }
    for(const name of ['game','items','settings','help'])if(views[name]){
      const button=document.createElement('button');button.type='button';button.textContent=names[name];button.dataset.view=name;button.onclick=()=>selectView(name);navigation.append(button);
    }
    menu.querySelector('.game-menu-heading').after(navigation);
    document.addEventListener('utxoplay:menu-view',event=>selectView(event.detail.view));
    selectView('game');
    for(const dialog of surface.querySelectorAll('dialog'))if(dialog!==menu)dialog.addEventListener('close',()=>opener.focus());
  }
  const actions = document.createElement('div');
  actions.className = 'game-system-actions';
  const fullscreen = document.createElement('button');
  fullscreen.type = 'button';
  fullscreen.textContent = 'Toggle fullscreen';
  fullscreen.onclick = async () => {
    try {
      let doc=document;
      try {if(window.parent!==window&&parent.location.origin===location.origin)doc=parent.document;} catch {}
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await doc.documentElement.requestFullscreen();
    } catch {fullscreen.textContent = 'Fullscreen unavailable';}
  };
  const store = document.createElement('a');
  store.href = '/';store.target = '_top';store.textContent = 'Back to store';
  const reload = document.createElement('button');
  reload.type = 'button';reload.textContent = 'Reload game';
  const confirmation = document.createElement('span');
  confirmation.className = 'game-reload-confirmation';confirmation.hidden = true;
  confirmation.append(document.createTextNode('Reload this game? The current connection will close. '));
  const yes = document.createElement('button');yes.type = 'button';yes.textContent = 'Reload';yes.onclick = () => location.reload();
  const no = document.createElement('button');no.type = 'button';no.textContent = 'Cancel';no.onclick = () => {confirmation.hidden=true;reload.hidden=false;reload.focus();};
  confirmation.append(yes,no);
  reload.onclick = () => {reload.hidden=true;confirmation.hidden=false;no.focus();};
  actions.append(fullscreen,store,reload,confirmation);
  (menu.querySelector('.game-menu-content') || menu).append(actions);
  const badge = document.createElement('span');
  badge.className = 'game-myelin-badge';
  badge.title = 'Myelin · off-chain host replay';
  badge.innerHTML = '<img src="/assets/myelin-logo.png?v=0.7.1" alt="" width="24" height="24"><span>MYELIN</span>';
  if(kind === 'openstrike') {
    surface.querySelector('.top > div').append(badge);
    surface.querySelector('.top small').hidden = true;
  } else surface.append(badge);

})();
