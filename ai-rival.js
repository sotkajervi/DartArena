(()=>{
'use strict';
const $=id=>document.getElementById(id);
const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
const notice=t=>$('rivalNotice').textContent=t;
let me=null,profiles=[],game=null,model=null,modelPlayer=null;
const random=()=>Math.random();
const sample=(arr)=>arr[Math.floor(random()*arr.length)];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function modelFrom(visits){
 const rows=visits.filter(v=>Number.isInteger(v.score)&&v.score>=0&&v.score<=180);
 const normal=rows.filter(v=>!v.is_checkout);
 const checkouts=rows.filter(v=>v.is_checkout);
 const scores=normal.map(v=>v.score);
 const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
 const pressureScores=normal.filter(v=>v.score<=100).map(v=>v.score);
 return {count:rows.length,checkoutCount:checkouts.length,avg,scores,pressureScores,
 checkoutScores:checkouts.map(v=>v.score),checkoutDarts:checkouts.map(v=>clamp(Number(v.darts_used)||3,1,3))};
}
function scoreIsPossibleCheckout(score){
 // With double-out, a finishing total must be reachable by 1–3 darts.
 if(score<2||score>170||score===169||score===168||score===166||score===165||score===163||score===162||score===159)return false;
 return true;
}
function chooseBotTurn(remaining){
 const finishing=remaining<=170&&scoreIsPossibleCheckout(remaining);
 // With only visit-level records we estimate checkout odds rather than claim per-double accuracy.
 const checkoutRate=model.checkoutCount/Math.max(1,model.count);
 const chance=clamp(checkoutRate*(remaining<=40?5:remaining<=80?2.9:1.25),.015,.58);
 if(finishing&&random()<chance)return {score:remaining,darts:sample(model.checkoutDarts)||3,checkout:true};
 const pool=remaining<=100&&model.pressureScores.length>=20?model.pressureScores:model.scores;
 for(let tries=0;tries<30;tries++){
  const value=sample(pool)||0;
  if(remaining-value>1)return {score:value,darts:3,checkout:false};
 }
 return {score:0,darts:3,checkout:false};
}
function snapshot(){return JSON.parse(JSON.stringify({human:game.human,bot:game.bot,hlegs:game.hlegs,blegs:game.blegs,active:game.active,finished:game.finished,log:game.log}))}
function log(label){game.log.unshift(label);game.log=game.log.slice(0,50)}
function restore(s){Object.assign(game,s);render()}
function winLeg(winner,darts){
 if(winner==='human')game.hlegs++;else game.blegs++;
 log((winner==='human'?'Du':'AI Rival')+' vant leg'+(darts?' ('+darts+' piler på siste runde)':''));
 if(game.hlegs>=game.needed||game.blegs>=game.needed){game.finished=true;game.active='none';render();return}
 game.human=game.bot=501;
 // Human throws first in every leg in this initial training prototype.
 game.active='human';
}
function botTurn(){
 if(game.finished)return;
 const t=chooseBotTurn(game.bot);
 const before=game.bot;
 if(t.checkout){game.bot=0;log('AI: '+before+' checkout');winLeg('bot',t.darts)}
 else {game.bot-=t.score;log('AI: '+t.score+' ('+before+' → '+game.bot+')')}
 game.active=game.finished?'none':'human';
 render();
}
function render(){
 if(!game)return;
 $('rivalHumanScore').textContent=game.human;$('rivalBotScore').textContent=game.bot;
 $('rivalHumanLegs').textContent=game.hlegs+' legs';$('rivalBotLegs').textContent=game.blegs+' legs';
 $('rivalHumanScore').classList.toggle('active',game.active==='human');
 $('rivalBotScore').classList.toggle('active',game.active==='bot');
 $('rivalThrow').disabled=game.finished;$('rivalInput').disabled=game.finished;
 $('rivalUndo').disabled=!game.history.length;
 $('rivalStatus').textContent=game.finished?(game.hlegs>game.blegs?'Du vant kampen!':'AI Rival vant kampen!'):'Din tur · '+game.human+' igjen';
 $('rivalLog').replaceChildren(...game.log.map(t=>{const d=document.createElement('div');d.textContent=t;return d}));
}
async function loadModel(id){
 $('rivalStart').disabled=true;model=null;
 const {data,error}=await db.from('match_throws').select('id,match_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,matches!inner(game,game_variant)').eq('player_id',id).eq('matches.game',501).eq('matches.game_variant','x01').order('id',{ascending:false}).limit(2500);
 if(error){$('rivalModel').textContent='Kunne ikke lese 501-historikk: '+error.message;return}
 modelPlayer=profiles.find(p=>p.id===id);
 try{
  const trained=window.DartArenaRivalModel.build(data||[],window.DartArenaLocalH2HEngine);
  model={...modelFrom(data||[]),count:trained.historyVisits,checkoutCount:trained.historyCheckouts,avg:trained.historyAverage};
  $('rivalModel').textContent=modelPlayer.username+' · '+trained.historyVisits+' registrerte 501-runder · historisk 3-dart-snitt '+trained.historyAverage.toFixed(2)+' · kalibrert AI-snitt '+trained.estimatedAverage.toFixed(2)+' · '+trained.historyCheckouts+' checkouts.';
 }catch(e){model=null;$('rivalModel').textContent=e.message||'Kunne ikke bygge AI-modellen.';return}
 $('rivalStart').disabled=false;
}
async function init(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){notice('Logg inn i DartArena før du bruker AI Rival.');$('rivalPlayer').innerHTML='<option>Innlogging kreves</option>';return}
 me=session.user.id;
 const {data,error}=await db.from('profiles').select('id,username').order('username');
 if(error){notice('Kunne ikke hente spillere: '+error.message);return}
 profiles=(data||[]).filter(p=>p.username&&!["d32a4234-68fa-4c94-a0b0-2aff4831344a","049fdb78-ee46-41cb-a25f-a48d90a028e5"].includes(p.id));
 const sel=$('rivalPlayer');sel.replaceChildren(...profiles.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.username+(p.id===me?' (deg selv)':'');return o}));
 sel.value=profiles.some(p=>p.id===me)?me:profiles[0]?.id||'';
 if(sel.value)await loadModel(sel.value);
}
$('rivalPlayer').addEventListener('change',e=>loadModel(e.target.value));
$('rivalStart').addEventListener('click',()=>{
 if(!model||model.count<30||!modelPlayer)return;
 const best=Number($('rivalLegs').value);
 location.href='ai-rival-501.html?player='+encodeURIComponent(modelPlayer.id)+'&legs='+encodeURIComponent(best);
});

function throwScore(){
 if(!game||game.finished)return;
 const raw=$('rivalInput').value.trim(),n=Number(raw);
 if(raw===''||!Number.isInteger(n)||n<0||n>180){$('rivalStatus').textContent='Skriv en score mellom 0 og 180.';return}
 const before=game.human,rest=before-n;
 if(rest<0||rest===1){game.history.push(snapshot());log('Du: bust ('+n+')');}
 else if(rest===0){
  const darts=Number($('rivalDarts').value);
  if(!scoreIsPossibleCheckout(before)||(darts===1&&!(before===50||(before<=40&&before%2===0)))||(darts===2&&before>110)){$('rivalStatus').textContent='Ugyldig dobbel-ut med '+darts+' piler fra '+before+'.';return}
  game.history.push(snapshot());game.human=0;log('Du: checkout '+n);winLeg('human',darts);
  $('rivalInput').value='';render();return;
 }else{game.history.push(snapshot());game.human=rest;log('Du: '+n+' ('+before+' → '+rest+')')}
 $('rivalInput').value='';
 if(!game.finished){game.active='bot';botTurn()}else render();
}
$('rivalThrow').onclick=throwScore;
$('rivalInput').addEventListener('keydown',e=>{if(e.key==='Enter')throwScore()});
$('rivalUndo').onclick=()=>{if(!game?.history.length)return;const s=game.history.pop();restore(s)};
init().catch(e=>notice('Kunne ikke starte AI Rival: '+e.message));
})();