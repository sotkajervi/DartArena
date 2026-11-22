
/* Owner-only launch, both players can score. Uses existing room video unchanged. */
(()=>{
'use strict';
const R=window.DartArenaChallengeRoomState,E=window.DartArenaPentathlon;
if(!R||!E)return;
const $=id=>document.getElementById(id),db=R.client(),challengeId=R.challengeId();
if(!challengeId)return;
let uid=null,challenge=null,record=null,channel=null,poll=null,pending=[],saving=false;
const copy=o=>JSON.parse(JSON.stringify(o));
const clean=o=>{const a=copy(o);delete a.undo;return a};
const game=()=>record?.state,stage=()=>game()?.current;
const player=()=>uid===challenge?.challenger_id?0:1;
const mine=()=>game()?.status==='playing'&&stage()?.turn===player();
const msg=(s,bad=false)=>{const el=$('ptMessage');if(el){el.textContent=s;el.classList.toggle('error',bad)}};
function node(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el}
function setup(){
 const start=node('button','outline','Pentathlon Online · TEST');
 start.id='ptStart';start.hidden=true;start.onclick=startGame;
 document.querySelector('.room-head-copy')?.append(start);
 const panel=node('section','card pt-panel');panel.id='ptPanel';panel.hidden=true;
 panel.innerHTML='<div class="pt-head"><div><small>OWNER TEST · IKKE RANKET</small><h2>Pentathlon Online</h2><p class="muted compact">Samme venterom og kamera · 7 øvelser</p></div><button type="button" class="outline" id="ptRefresh">Oppdater</button></div>'+
 '<p id="ptProgress" class="pt-progress"></p>'+
 '<div class="pt-players"><article id="ptCard0"><span id="ptName0"></span><strong id="ptScore0"></strong><small id="ptDetail0"></small></article><article id="ptCard1"><span id="ptName1"></span><strong id="ptScore1"></strong><small id="ptDetail1"></small></article></div>'+
 '<div class="pt-target"><small id="ptStage"></small><h2 id="ptTarget"></h2><p id="ptTurn"></p></div>'+
 '<div id="ptX01" class="pt-actions"><input type="number" min="0" max="180" inputmode="numeric" id="ptInput" placeholder="Score 0–180"><button type="button" class="primary" id="ptXSubmit">Registrer / Enter</button></div>'+
 '<div id="ptSpecial" class="pt-actions"><div id="ptChoices"></div><p>Valgt: <span id="ptPending">–</span></p><button type="button" class="outline" id="ptRemove">Fjern siste</button><button type="button" class="primary" id="ptSSubmit">Registrer / Enter</button></div>'+
 '<div class="pt-bottom"><button type="button" class="primary" id="ptAdvance" hidden>Neste øvelse</button><button type="button" class="outline" id="ptUndo">Angre siste tur</button></div>'+
 '<p id="ptMessage" role="status" aria-live="polite"></p><div id="ptLog" class="pt-log"></div>';
 $('matchView')?.append(panel);
 $('ptRefresh').onclick=refresh;
 $('ptXSubmit').onclick=submitX01;
 $('ptSSubmit').onclick=submitSpecial;
 $('ptRemove').onclick=()=>{pending.pop();render()};
 $('ptAdvance').onclick=advance;
 $('ptUndo').onclick=undo;
 $('ptInput').onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();submitX01()}};
 document.addEventListener('keydown',ev=>{
   if(!record||saving||ev.repeat||ev.ctrlKey||ev.altKey||ev.metaKey||ev.isComposing)return;
   if(['INPUT','TEXTAREA','SELECT'].includes(ev.target?.tagName)||ev.target?.isContentEditable)return;
   if(ev.key==='Enter'){
     if(game().status==='review'){ev.preventDefault();advance()}
     else if(mine()){ev.preventDefault();stage().kind==='x01'?$('ptInput').focus():submitSpecial()}
   }else if(ev.key==='Backspace'&&pending.length){ev.preventDefault();pending.pop();render()}
   else if(mine()&&stage().kind!=='x01'){
     const btn=[...$('ptChoices').querySelectorAll('button')].find(b=>b.dataset.key===ev.key);
     if(btn){ev.preventDefault();btn.click()}
   }
 });
}
function choice(key,label,dart){
 const b=node('button','outline',label);b.type='button';b.dataset.key=key;
 const c=stage();b.disabled=saving||!mine()||pending.length>=Math.min(3-c.pending.length,c.kind==='clock'?42-c.used[c.turn]:3);
 b.onclick=()=>{if(b.disabled)return;pending.push(dart);render()};
 $('ptChoices').append(b);
}
function actions(){
 const c=stage(),kind=c.kind,host=$('ptChoices');host.replaceChildren();
 if(kind==='shanghai'){
   const n=E.currentTarget(game()).number;
   choice('1','SINGLE · 1',{n,m:1});choice('2','DOUBLE · 2',{n,m:2});choice('3','TRIPLE · 3',{n,m:3});
 }else if(kind==='clock'){
   let n=c.clockTarget[c.turn];for(const d of pending)if(d.n===n&&d.m===2)n++;
   if(n<=20)choice('2','TREFF D'+n+' · 2',{n,m:2});
 }else if(kind==='half'){
   const t=E.currentTarget(game());
   for(const m of t.mult?[t.mult]:[1,2,3]){
     choice(String(m),(m===1?'SINGLE':m===2?'DOUBLE':'TRIPLE')+' · '+m,{n:t.number,m});
   }
 }
 if(!(kind==='clock'&&(c.clockTarget[c.turn]>20||pending.some(d=>d.n===20&&d.m===2))))
   choice('0','BOM · 0',{n:0,m:0});
}
function render(){
 if(!record)return;
 document.body.classList.add('pt-active');$('ptPanel').hidden=false;$('ptStart').hidden=true;
 const s=game(),c=s.current,live=s.status==='playing',review=s.status==='review';
 const st=E.STAGES[s.stageIndex];
 $('ptProgress').textContent=s.status==='finished'?'Alle øvelser fullført':'Øvelse '+(s.stageIndex+1)+' av 7 · '+st.label;
 for(let i=0;i<2;i++){
   $('ptName'+i).textContent=s.players[i];
   $('ptScore'+i).textContent=s.total[i]+c.pent[i];
   $('ptDetail'+i).textContent=c.pent[i]+' P denne øvelsen · '+c.used[i]+' piler';
   $('ptCard'+i).classList.toggle('active',live&&c.turn===i);
 }
 let target=live?E.currentTarget(s)?.label:null;
 if(live&&c.kind==='clock'){
   let n=c.clockTarget[c.turn];for(const d of pending)if(d.n===n&&d.m===2)n++;
   target=n>20?'D20 FULLFØRT':'D'+n;
 }
 $('ptStage').textContent=st?.label||'Ferdig';
 $('ptTarget').textContent=live?target:review?'Øvelse fullført':'Pentathlon fullført';
 $('ptTurn').textContent=live?s.players[c.turn]+' kaster'+(mine()?' · DIN TUR':' · vent'):
   review?'Trykk Neste øvelse for å fortsette.':
   (s.total[0]===s.total[1]?'Uavgjort':s.players[s.total[0]>s.total[1]?0:1]+' vant')+' · '+s.total.join('–');
 $('ptX01').hidden=!live||c.kind!=='x01';$('ptSpecial').hidden=!live||c.kind==='x01';
 $('ptAdvance').hidden=!review;$('ptAdvance').disabled=saving;
 $('ptInput').disabled=saving||!mine();$('ptXSubmit').disabled=saving||!mine();
 $('ptUndo').disabled=saving||!record.last_actor||record.last_actor!==uid||!(live||review)||!(s.undo?.length);
 if(live&&c.kind!=='x01'){
   actions();$('ptPending').textContent=pending.map(E.labelDart).join(' · ')||'–';
   $('ptRemove').disabled=saving||!mine()||!pending.length;
   $('ptSSubmit').disabled=saving||!mine();
 }
 $('ptLog').replaceChildren(...c.entries.slice(-8).reverse().map(e=>
   node('div','pt-entry',s.players[e.player]+': '+(e.type==='visit'?'Score '+e.score:e.target+' · '+e.hit)+' · +'+e.bonus+' P')));
}
async function refresh(){
 if(!uid||!challenge)return;
 const {data,error}=await db.from('pentathlon_room_tests').select('*').eq('challenge_id',challengeId).maybeSingle();
 if(error){msg('Synkronisering feilet: '+error.message,true);return}
 if(data&&(!record||data.version>record.version)){
   record=data;pending=[];render();
 }else if(!data&&record){
   record=null;document.body.classList.remove('pt-active');$('ptPanel').hidden=true;
 }
}
async function broadcast(){
 await channel?.send({type:'broadcast',event:'changed',payload:{from:uid}}).catch(()=>{});
}
async function startGame(){
 if(saving||record)return;saving=true;$('ptStart').disabled=true;
 try{
   const {data:p,error:pe}=await db.from('profiles').select('id,username').in('id',[challenge.challenger_id,challenge.challenged_id]);
   if(pe)throw pe;
   const name=id=>p?.find(x=>x.id===id)?.username||'Spiller';
   const seed=E.create({name1:name(challenge.challenger_id),name2:name(challenge.challenged_id),starter:Math.random()<.5?0:1});
   const {data,error}=await db.rpc('start_pentathlon_room_test',{p_challenge_id:challengeId,p_state:seed});
   if(error)throw error;record=data;pending=[];render();msg('Test startet. Ingen karriere- eller rankingstatistikk.');
   await broadcast();
 }catch(e){msg(e.message||String(e),true)}
 finally{saving=false;$('ptStart').disabled=false;if(record)render()}
}
async function save(action,next){
 if(!record||saving)return;
 saving=true;const version=record.version;render();
 try{
   const {data,error}=await db.rpc('apply_pentathlon_room_test',{
     p_challenge_id:challengeId,p_expected_version:version,p_action:action,p_next:next
   });
   if(error)throw error;
   record=data;pending=[];$('ptInput').value='';render();msg('Registrert.');await broadcast();
 }catch(e){msg('Kunne ikke lagre: '+(e.message||e)+'. Henter ny kampstatus.',true);await refresh()}
 finally{saving=false;if(record)render()}
}
function turnState(next){const n=clean(next);n.undo=[clean(game())];return n}
function submitX01(){
 if(!mine()||saving||stage().kind!=='x01')return;
 const raw=$('ptInput').value.trim(),n=Number(raw);
 if(!raw||!E.isScore(n)){msg('Skriv score fra 0 til 180.',true);return}
 let darts=3,confirmed=false;
 if(n===stage().remaining[stage().turn]){
   const answer=prompt('Checkout: antall piler (1, 2 eller 3)?','2');
   if(answer===null)return;darts=Number(answer);confirmed=true;
 }
 try{save('turn',turnState(E.submitX01(game(),{score:n,darts,doubleConfirmed:confirmed})))}
 catch(e){msg(e.message||String(e),true)}
}
function submitSpecial(){
 if(!mine()||saving||stage().kind==='x01')return;
 try{
   let next=game(),c=stage();
   if(c.kind==='shanghai')next=E.submitShanghaiTurn(next,pending);
   else if(c.kind==='clock')next=E.submitClockTurn(next,pending);
   else{
     const darts=[...pending];while(darts.length<3-c.pending.length)darts.push({n:0,m:0});
     for(const dart of darts)next=E.submitDart(next,dart);
   }
   save('turn',turnState(next));
 }catch(e){msg(e.message||String(e),true)}
}
function advance(){
 if(game()?.status!=='review'||saving)return;
 try{const n=clean(E.nextStage(game()));n.undo=[];save('advance',n)}
 catch(e){msg(e.message||String(e),true)}
}
function undo(){
 if(!record||record.last_actor!==uid||saving||!['playing','review'].includes(game()?.status))return;
 try{const n=clean(E.undo(game()));n.undo=[];save('undo',n)}
 catch(e){msg(e.message||String(e),true)}
}
async function boot(){
 setup();
 for(let i=0;i<100&&!R.user();i++)await new Promise(resolve=>setTimeout(resolve,100));
 uid=R.user();if(!uid)return;
 const {data,error}=await db.from('challenges').select('id,challenger_id,challenged_id,status').eq('id',challengeId).maybeSingle();
 if(error||!data||data.status!=='room'||![data.challenger_id,data.challenged_id].includes(uid))return;
 challenge=data;
 const {data:isOwner}=await db.rpc('is_owner');
 $('ptStart').hidden=!isOwner;
 channel=db.channel('pentathlon-room-test-'+challengeId)
  .on('postgres_changes',{event:'*',schema:'public',table:'pentathlon_room_tests',filter:'challenge_id=eq.'+challengeId},()=>refresh())
  .on('broadcast',{event:'changed'},()=>refresh())
  .subscribe();
 await refresh();
 poll=setInterval(()=>{if(record&&!document.hidden)refresh()},6000);
}
window.addEventListener('pagehide',()=>{clearInterval(poll);if(channel)db.removeChannel(channel).catch(()=>{})},{once:true});
boot().catch(e=>console.warn('Pentathlon room test failed',e));
})();