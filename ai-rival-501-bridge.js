(()=>{
'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const playerId=params.get('player');
const requestedLegs=Number(params.get('legs'))||3;
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
const E=window.DartArenaLocalH2HEngine;
const B=window.DartArenaBotEngine;
const form=$('localSetupForm'),start=form?.querySelector('button[type=submit]');
if(!form||!db||!E||!B)return;
if(start)start.disabled=true;
const notice=document.createElement('p');notice.className='muted compact';notice.id='aiRivalModelInfo';
form.after(notice);
notice.textContent='Laster AI Rival fra DartArena-historikken…';
const pick=values=>values[Math.floor(Math.random()*values.length)];
function makeModel(visits){
 const valid=visits.filter(v=>Number.isInteger(v.score)&&v.score>=0&&v.score<=180);
 const normal=valid.filter(v=>!v.is_checkout);
 const checkouts=valid.filter(v=>v.is_checkout);
 const scores=normal.map(v=>v.score);
 const avg=scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length);
 return {normal:scores,checkoutCount:checkouts.length,total:valid.length,average:avg};
}
function makeVisit(remaining,model){
 const options=E.checkoutOptions(remaining);
 // Attempt checkouts independently; never remove historical scoring visits from the model.
 const rate=model.checkoutCount/Math.max(1,model.total);
 const likelihood=Math.min(.58,Math.max(.015,rate*(remaining<=40?5:remaining<=80?2.9:1.25)));
 if(options.length&&Math.random()<likelihood){
  return {score:remaining,bust:false,checkout:true,darts:pick(options),throws:[]};
 }
 // Draw only legal non-checkout totals. Rejection sampling used to emit 0
 // despite valid historical totals being available, especially below 100.
 const legal=model.normal.filter(s=>s<=remaining-2&&E.validScore(s));
 if(legal.length){
  const score=pick(legal);
  return {score,bust:false,checkout:false,darts:3,throws:[]};
 }
 // No historical total can leave a legal double-out remainder.
 return {score:0,bust:false,checkout:false,darts:3,throws:[]};
}
const selector=$('rivalHistoryPlayer');
let loading=false;
async function loadRival(id,{autoStart=false}={}){
 if(loading)return;
 loading=true;
 if(start)start.disabled=true;
 notice.textContent='Laster spillerhistorikk…';
 try{
  if(!id)throw Error('Velg en DartArena-spiller som AI Rival.');
  const {data:{session},error:authError}=await db.auth.getSession();
  if(authError||!session)throw Error('Logg inn i DartArena for å velge AI Rival.');
  const [{data:player,error:pe},{data:me,error:meError},{data:visits,error:ve}]=await Promise.all([
   db.from('profiles').select('id,username').eq('id',id).single(),
   db.from('profiles').select('username').eq('id',session.user.id).single(),
   db.from('match_throws').select('score,is_checkout').eq('player_id',id).order('id',{ascending:false}).limit(2500)
  ]);
  if(pe||!player?.username)throw Error('Fant ikke spilleren.');
  if(meError)throw Error('Kunne ikke hente din profil.');
  if(ve)throw Error('Kunne ikke lese spillerens registrerte runder.');
  const model=makeModel(visits||[]);
  if(model.normal.length<30)throw Error(player.username+' har for få registrerte kasterunder (minst 30 kreves).');
  window.DartArenaRivalProfile={id,name:player.username};
  B.visit=remaining=>makeVisit(remaining,model);
  try{localStorage.setItem('dartarena-ai-rival-501-selected-player',id)}catch{}
  window.dispatchEvent(new Event('dartarena:rival-ready'));
  $('localName1').value=me?.username||'Spiller';
  $('localOpponentType').value='bot';
  $('localOpponentType').dispatchEvent(new Event('change',{bubbles:true}));
  $('localBotMode').value='standard';
  $('localFormat').value='501';
  $('localMode').value='legs';
  $('localMode').dispatchEvent(new Event('change',{bubbles:true}));
  const best=$('localBestOf');
  if(autoStart&&[...best.options].some(o=>Number(o.value)===requestedLegs))best.value=String(requestedLegs);
  notice.textContent='AI Rival: '+player.username+' · '+model.total+' historiske kasterunder · rundesnitt uten checkout '+model.average.toFixed(1)+'. Resultatet lagres lokalt.';
  if(start)start.disabled=false;
  if(autoStart&&$('localGame')?.hidden)form.requestSubmit();
 }catch(error){
  window.DartArenaRivalProfile=null;
  notice.textContent=error.message||'Kunne ikke laste AI Rival.';
 }finally{loading=false}
}
async function init(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){notice.textContent='Logg inn for å velge AI Rival.';selector.innerHTML='<option value="">Innlogging kreves</option>';return}
 const {data,error}=await db.from('profiles').select('id,username').order('username');
 if(error)throw error;
 const profiles=(data||[]).filter(p=>p.id&&p.username&&!["d32a4234-68fa-4c94-a0b0-2aff4831344a","049fdb78-ee46-41cb-a25f-a48d90a028e5"].includes(p.id));
 selector.replaceChildren(new Option('Velg AI Rival…',''),...profiles.map(p=>new Option(p.username+(p.id===session.user.id?' (deg selv)':''),p.id)));
 let saved='';try{saved=localStorage.getItem('dartarena-ai-rival-501-selected-player')||''}catch{}
 const initial=[playerId,saved].find(id=>profiles.some(p=>p.id===id))||'';
 if(initial){selector.value=initial;await loadRival(initial,{autoStart:!!playerId})}
 else notice.textContent='Velg en DartArena-spiller over for å bruke den registrerte kasthistorikken som AI Rival.';
}
selector.addEventListener('change',()=>loadRival(selector.value));
init().catch(error=>{notice.textContent=error.message||'Kunne ikke laste spillere.';if(start)start.disabled=true});
})();
