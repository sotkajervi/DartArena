'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'tournament-ready-lobby.js'),'utf8');

function setup(){
  const listeners={window:{},document:{},modal:{}};
  const classes=new Set(['hidden']);
  const navigations=[];
  let timer=null,focusCount=0,hidden=false,playing=false,lobbyHidden=false;
  let user={id:'player-a',status:'available'};
  const nodes={
    tournamentReadyModal:{
      classList:{add(n){classes.add(n)},remove(n){classes.delete(n)},contains(n){return classes.has(n)}},
      addEventListener(n,fn){listeners.modal[n]=fn}
    },
    tournamentReadyName:{textContent:''},
    tournamentReadyCountdown:{textContent:'8'},
    tournamentReadyGo:{addEventListener(n,fn){listeners.go=fn},focus(){focusCount++}},
    tournamentReadyStay:{addEventListener(n,fn){listeners.stay=fn}},
    lobbyView:{classList:{contains(n){return n==='hidden'&&lobbyHidden}}}
  };
  const ctx={
    document:{
      get hidden(){return hidden},
      getElementById(id){return nodes[id]||null},
      addEventListener(n,fn){listeners.document[n]=fn}
    },
    window:{addEventListener(n,fn){listeners.window[n]=fn}},
    get profile(){return user},
    get activeMatch(){return playing?{id:'match-live'}:null},
    location:{assign(url){navigations.push(url)}},
    setInterval(fn){timer=fn;return 1},
    clearInterval(){timer=null},
    encodeURIComponent
  };
  vm.runInNewContext(script,ctx);
  const snapshot=(status,{id='tour-1',name='Kveldsturnering',eligible=true,userId='player-a'}={})=>{
    listeners.window['dartarena:tournament-lobby-snapshot']({detail:{
      userId,
      tournaments:[{id,name,status,eligible}]
    }});
  };
  return{
    snapshot, nodes, navigations,
    get visible(){return !classes.has('hidden')},
    get focusCount(){return focusCount},
    get timerActive(){return !!timer},
    tick(){if(timer)timer()},
    go(){listeners.go()},
    stay(){listeners.stay()},
    escape(){listeners.modal.keydown({key:'Escape',preventDefault(){}})},
    setHidden(v){hidden=v;listeners.document.visibilitychange()},
    setPlaying(v){playing=v},
    setLobbyHidden(v){lobbyHidden=v},
    setUser(v){user=v},
    logout(){listeners.window['dartarena:tournament-lobby-snapshot']({detail:{userId:null,tournaments:[]}})}
  };
}
test('unconfirmed draw and initial active tournament do not redirect',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups_setup');
  assert.equal(ui.visible,false);
  assert.equal(ui.navigations.length,0);
  const already=setup();
  already.snapshot('groups');
  assert.equal(already.visible,false);
});
test('confirmed transition shows a branded dialog and countdown',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups');
  assert.equal(ui.visible,true);
  assert.equal(ui.nodes.tournamentReadyName.textContent,'Kveldsturnering');
  assert.equal(ui.nodes.tournamentReadyCountdown.textContent,'8');
  assert.equal(ui.focusCount,1);
  for(let i=0;i<7;i++)ui.tick();
  assert.equal(ui.nodes.tournamentReadyCountdown.textContent,'1');
  assert.deepEqual(ui.navigations,[]);
  ui.tick();
  assert.deepEqual(ui.navigations,['tournament.html?id=tour-1']);
  assert.equal(ui.visible,false);
});
test('only enrolled players or tournament owner can receive the redirect',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups',{eligible:false});
  assert.equal(ui.visible,false);
  assert.deepEqual(ui.navigations,[]);
});
test('player can go immediately or stay without repeated notifications',()=>{
  const go=setup();
  go.snapshot('groups_setup');
  go.snapshot('groups');
  go.go();
  assert.deepEqual(go.navigations,['tournament.html?id=tour-1']);
  const stay=setup();
  stay.snapshot('groups_setup');
  stay.snapshot('groups');
  stay.stay();
  assert.equal(stay.visible,false);
  stay.snapshot('groups');
  assert.equal(stay.visible,false);
  assert.deepEqual(stay.navigations,[]);
});
test('active match is never interrupted by group announcement',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.setPlaying(true);
  ui.snapshot('groups');
  assert.equal(ui.visible,false);
  assert.deepEqual(ui.navigations,[]);
});
test('playing during countdown cancels pending redirect',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups');
  ui.setPlaying(true);
  ui.tick();
  assert.equal(ui.visible,false);
  assert.deepEqual(ui.navigations,[]);
});
test('hidden browser tab waits until it is visible',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.setHidden(true);
  ui.snapshot('groups');
  assert.equal(ui.visible,false);
  ui.setHidden(false);
  assert.equal(ui.visible,true);
  ui.setHidden(true);
  ui.tick();
  assert.equal(ui.nodes.tournamentReadyCountdown.textContent,'8');
  assert.deepEqual(ui.navigations,[]);
});
test('not logged in or not in main lobby: no modal',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.setLobbyHidden(true);
  ui.snapshot('groups');
  assert.equal(ui.visible,false);
  const u2=setup();
  u2.snapshot('groups_setup');
  u2.setUser({id:'someone-else',status:'available'});
  u2.snapshot('groups');
  assert.equal(u2.visible,false);
});
test('cancelled tournament dismisses a visible dialog',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups');
  ui.snapshot('cancelled');
  assert.equal(ui.visible,false);
  assert.deepEqual(ui.navigations,[]);
});
test('logout resets pending invitations and previous user state',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups');
  ui.logout();
  assert.equal(ui.visible,false);
  ui.snapshot('groups');
  assert.equal(ui.visible,false);
});
test('Escape dismisses the dialog',()=>{
  const ui=setup();
  ui.snapshot('groups_setup');
  ui.snapshot('groups');
  ui.escape();
  assert.equal(ui.visible,false);
  ui.snapshot('groups');
  assert.equal(ui.visible,false);
});
test('lobby feed uses registered participants or tournament leader',()=>{
  const feed=fs.readFileSync(path.join(root,'tournaments.js'),'utf8');
  assert.match(feed,/m\.user_id===me&&m\.role==='participant'/);
  assert.match(feed,/eligible:t\.owner_id===me\|\|joinedIds\.has\(t\.id\)/);
  assert.match(feed,/dartarena:tournament-lobby-snapshot/);
  const tournament=fs.readFileSync(path.join(root,'tournament.js'),'utf8');
  assert.match(tournament,/function drawGroups\(\)[\s\S]*?drawnGroups=Array\.from/);
  assert.match(tournament,/async function startGroups\(\)[\s\S]*?\.update\(\{status:'groups'/);
});
test('lobby loads themed dialog after app and tournaments, with refreshed assets',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="tournamentReadyModal" class="modal hidden"/);
  assert.match(html,/tournament-ready-lobby\.css\?v=20261013-groupsready1/);
  assert.match(html,/tournaments\.js\?v=20261013-groupsready1/);
  assert.match(html,/tournament-ready-lobby\.js\?v=20261013-groupsready1/);
  assert.ok(html.indexOf('app.js?v=')<html.indexOf('tournaments.js?v='));
  assert.ok(html.indexOf('tournaments.js?v=')<html.indexOf('tournament-ready-lobby.js?v='));
});
