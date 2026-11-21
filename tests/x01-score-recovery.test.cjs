const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
async function simulate(source){
 const assert=(x,msg)=>{if(!x)throw Error(msg)};
 const tick=async()=>{for(let i=0;i<60;i++)await Promise.resolve()};
 const nodes={};
 const target=()=>({events:{},addEventListener(k,f){(this.events[k]??=[]).push(f)},removeEventListener(k,f){this.events[k]=(this.events[k]||[]).filter(x=>x!==f)},emit(k,e={}){for(const f of this.events[k]||[])f({preventDefault(){},stopImmediatePropagation(){},...e})}});
 const doc={...target(),hidden:false,getElementById(id){return nodes[id]||(nodes[id]={...target(),value:'',textContent:'',disabled:false,focus(){},classList:{toggle(){}}})}};
 const win={...target(),DartArenaCheckout:{possibleDarts:()=>[1,2,3],askDarts:async()=>1}};
 const player='A',opp='B',id='m';
 let stamp=0,server={id,status:'playing',turn_player_id:player,game_variant:'x01',game:501,legs:9,player1_id:player,player2_id:opp,player1_score:501,player2_score:501,updated_at:'v0'};
 let row={...server},calls=0,visits=0,failRead=false,lostReply=false,log=[],timers=[];
 let db={from(table){if(table==='client_error_logs')return{insert(v){log.push(v);return Promise.resolve({})}};return {select(){return this},eq(){return this},abortSignal(){return this},async single(){return failRead?{error:Error('offline')}:{data:{...server}}}}},rpc(name,p){return{async abortSignal(){assert(name==='submit_x01_checked','wrong RPC');calls++;if(p.p_expected_at!==server.updated_at)return {error:Error('DA_STALE_SCORE_STATE')};if(server.turn_player_id!==player)return {error:Error('DA_INVALID_SCORE_TURN')};visits++;server={...server,player1_score:server.player1_score-p.p_score,turn_player_id:opp,updated_at:'v'+(++stamp)};if(p.p_darts){server.status='finished';server.turn_player_id=null}if(lostReply){lostReply=false;return {error:Error('lost response')}}return {data:p.p_darts?{...server}:{match:{...server},bust:false}}}}}};
 const apply=x=>{row={...x};win.emit('dartarena:score-state')};win.DartArenaMatchEngineState={match:()=>row,profile:()=>({id:player}),client:()=>db,matchId:()=>id,applyScoreState:apply};
 const input=doc.getElementById('matchScoreInput');
 new Function('window','document','location','setInterval','clearInterval','setTimeout','clearTimeout','AbortController','requestAnimationFrame','console',source)(win,doc,{pathname:'/match.html'},fn=>{timers.push(fn);return timers.length},()=>{},()=>0,()=>{},class{signal={};abort(){}},fn=>fn(),{warn(){}});
 timers[0]();await tick();
 const type=n=>{input.value=String(n);input.emit('input')};
 const enter=()=>input.emit('keydown',{key:'Enter'});
 const turnBack=()=>{server={...server,turn_player_id:player,updated_at:'v'+(++stamp)};apply(server)};
 for(let i=0;i<20;i++){server.player1_score=501;row.player1_score=501;type(60);enter();enter();await tick();assert(visits===i+1,'double or lost visit '+i);assert(input.value==='','successful entry not cleared');turnBack()}
 type(60);server={...server,updated_at:'v'+(++stamp)};const before=calls;enter();await tick();assert(calls===before,'stale submission reached RPC');assert(input.value==='','stale entry retained');
 type(60);failRead=true;enter();await tick();assert(calls===before,'sent without verified status');assert(input.value==='60','offline input lost');failRead=false;enter();await tick();assert(visits===21,'retry did not recover');turnBack();
 type(60);lostReply=true;enter();await tick();assert(visits===22,'lost response did not commit');assert(input.value==='','uncertain committed entry replayable');turnBack();
 server={...server,turn_player_id:opp,updated_at:'v'+(++stamp)};timers[1]();await tick();assert(input.disabled,'poll failed to lock wrong turn');
 server={...server,turn_player_id:player,player1_score:40,updated_at:'v'+(++stamp)};timers[1]();await tick();assert(!input.disabled,'poll failed to restore turn');
 type(40);enter();await tick();assert(visits===23&&row.status==='finished','checkout failed');
 return {visits,calls,logs:log.map(x=>x.message),scenarios:6};
}
test('X01 guarded score: rapid Enter, stale state, network outage, lost response, polling and checkout',async()=>{await simulate(fs.readFileSync(path.join(__dirname,'..','set-engine.js'),'utf8'))});
