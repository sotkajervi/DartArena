const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('X01 focuses entry at match start and on new turn without stealing keyboard focus',async()=>{
 const listeners=()=>({events:{},addEventListener(k,f){(this.events[k]??=[]).push(f)},removeEventListener(k,f){this.events[k]=(this.events[k]||[]).filter(x=>x!==f)},emit(k){for(const f of this.events[k]||[])f()}});
 const nodes={};let focused=0,visible=true,mobile=false,dialogOpen=false,focusedWindow=true;
 const document={...listeners(),hidden:false,body:{tagName:'BODY'},hasFocus:()=>focusedWindow,activeElement:null,getElementById(id){
   if(!nodes[id])nodes[id]={...listeners(),tagName:id==='matchScoreInput'?'INPUT':'DIV',value:'',disabled:false,readOnly:false,
     textContent:'',classList:{toggle(){},contains:()=>!dialogOpen},focus(){document.activeElement=this;focused++},getClientRects:()=>[{}]};
   return nodes[id]
 }};
 const window={...listeners(),matchMedia:()=>({matches:mobile}),DartArenaCheckout:{askDarts:async()=>1,possibleDarts:()=>[1,2,3]}};
 let match={id:'m',updated_at:'2026-11-21T00:00:00Z',status:'playing',turn_player_id:'me',player1_id:'me',player2_id:'them',game:501,player1_score:501,player2_score:501,game_variant:'x01'};
 const db={from(t){return t==='client_error_logs'?{insert(){return Promise.resolve({})}}:{select(){return this},eq(){return this},abortSignal(){return this},async single(){return{data:match}}}},rpc(){return{async abortSignal(){return {error:new Error('not used')}}}}};
 window.DartArenaMatchEngineState={match:()=>match,matchId:()=>match.id,profile:()=>({id:'me'}),client:()=>db,applyScoreState:r=>{match=r;window.emit('dartarena:score-state')}};
 document.activeElement=document.body;
 const timers=[],timeouts=[];
 const code=fs.readFileSync(path.join(__dirname,'..','set-engine.js'),'utf8');
 new Function('window','document','location','setInterval','clearInterval','setTimeout','clearTimeout','AbortController','requestAnimationFrame','console',code)(
   window,document,{pathname:'/match.html'},(fn,ms)=>{timers.push({fn,ms});return timers.length},()=>{},(fn,ms)=>{timeouts.push({fn,ms});return timeouts.length},()=>{},class{signal={};abort(){}},fn=>fn(),{warn(){}}
 );
 timers[0].fn();
 assert.equal(focused,1,'starting player should get blinking caret');
 assert.equal(document.activeElement,nodes.matchScoreInput);
 // Server turn switch away must disable entry without focusing.
 match={...match,turn_player_id:'them',updated_at:'2026-11-21T00:00:01Z'};
 window.emit('dartarena:score-state');
 assert.equal(nodes.matchScoreInput.disabled,true);
 match={...match,turn_player_id:'me',updated_at:'2026-11-21T00:00:02Z'};
 document.activeElement=document.body;
 window.emit('dartarena:score-state');
 assert.equal(focused,2,'focus should return on next turn');
 // Do not steal focus from a separate textbox (chat, correction, etc.).
 match={...match,turn_player_id:'them',updated_at:'2026-11-21T00:00:03Z'};
 window.emit('dartarena:score-state');
 const otherInput={tagName:'INPUT',getClientRects:()=>[{}]};document.activeElement=otherInput;
 match={...match,turn_player_id:'me',updated_at:'2026-11-21T00:00:04Z'};
 window.emit('dartarena:score-state');
 assert.equal(document.activeElement,otherInput);
 // Window refocus shouldn't steal from an intentionally clicked button.
 const otherButton={tagName:'BUTTON',isConnected:true,getClientRects:()=>[{}]};document.activeElement=otherButton;
 window.emit('focus');
 assert.equal(document.activeElement,otherButton);
 // Mobile keypad and active checkout dialog must not trigger keyboard focus.
 mobile=true;document.activeElement=document.body;window.emit('focus');
 assert.equal(focused,2);
 mobile=false;dialogOpen=true;window.emit('focus');
 assert.equal(focused,2);
 dialogOpen=false;focusedWindow=false;window.emit('focus');
 assert.equal(focused,2);
 focusedWindow=true;window.emit('focus');
 assert.equal(focused,3,'returning to the visible active match should refocus');
 assert.equal(timeouts.some(t=>t.ms===700),true,'handoff focus recovery scheduled');
});
