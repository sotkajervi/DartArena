const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('x01-leg-starter-marker.js','utf8');
function setup(initial=null){
 const listeners=new Map();const els={};
 function node(){return{children:[],className:'',setAttribute(){},appendChild(x){x.parentElement=this;this.children.push(x);return x},querySelector(sel){return this.children.find(x=>'.'+x.className===sel)||null},remove(){this.parentElement.children=this.parentElement.children.filter(x=>x!==this)},insertBefore(a,b){this.children=this.children.filter(x=>x!==a);this.children.splice(this.children.indexOf(b),0,a)},get firstElementChild(){return this.children[0]}}}
 const wrap=node();els.matchP1=node();els.matchP2=node();wrap.appendChild(els.matchP1);wrap.appendChild(els.matchP2);els.matchName1=node();els.matchName2=node();
 const document={head:node(),createElement:node,getElementById:id=>els[id]||null};
 let row=initial;
 const window={addEventListener(e,f){if(!listeners.has(e))listeners.set(e,[]);listeners.get(e).push(f)},removeEventListener(e,f){listeners.set(e,(listeners.get(e)||[]).filter(x=>x!==f))}};
 const context=vm.createContext({window,document});
 const execute=()=>vm.runInContext(source,context);
 if(initial)window.DartArenaMatchEngineState={match:()=>row,matchId:()=>row?.id};
 execute();
 const emit=(e='dartarena:score-state')=>(listeners.get(e)||[]).slice().forEach(f=>f());
 return {window,els,wrap,listeners,execute,emit,set(r){row=r;window.DartArenaMatchEngineState={match:()=>row,matchId:()=>row?.id};emit()},count(id){return els[id].children.filter(x=>x.className==='da-leg-starter-dart').length}};
}
const base={id:'live',game_variant:'x01',status:'playing',player1_id:'a',player2_id:'b',match_starter_id:'a',current_set:1,current_leg:1,turn_player_id:'b'};
const room=setup();
assert.equal(typeof room.window.DartArenaLegStarterMarkerUI.create,'function');
assert.equal(room.count('matchName1'),0);
room.set(base);assert.equal(room.count('matchName1'),1);assert.equal(room.count('matchName2'),0);
const first=room.els.matchName1.children[0];room.set({...base,turn_player_id:'a'});assert.equal(room.els.matchName1.children[0],first);
room.execute();assert.equal(room.listeners.get('dartarena:score-state').length,1);
room.set({...base,current_leg:2,turn_player_id:'a'});assert.equal(room.count('matchName2'),1);assert.equal(room.count('matchName1'),0);
room.set({...base,current_set:2,current_leg:1});assert.equal(room.count('matchName2'),1);
room.set({...base,current_set:2,current_leg:2});assert.equal(room.count('matchName1'),1);
room.set({...base,status:'finished'});assert.equal(room.count('matchName1')+room.count('matchName2'),0);
const direct=setup({...base,match_starter_id:'b'});assert.equal(direct.count('matchName2'),1);assert.equal(direct.wrap.firstElementChild,direct.els.matchP2);
direct.set({...base,status:'cancelled'});assert.equal(direct.count('matchName1')+direct.count('matchName2'),0);
direct.emit('pagehide');assert.equal(direct.listeners.get('dartarena:score-state').length,0);
const other=setup({...base,game_variant:'pentathlon'});assert.equal(other.count('matchName1')+other.count('matchName2'),0);assert.equal(typeof other.window.DartArenaLegStarterMarkerUI.create,'function');
console.log(JSON.stringify({samePage:true,direct:true,alternateLegs:true,alternateSets:true,turnIndependent:true,sharedMarker:true,noDuplicateListeners:true,finishedCleared:true}));
