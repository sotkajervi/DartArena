(()=>{
'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const playerId=params.get('player');
const requestedLegs=Number(params.get('legs'))||3;
const requestedFormat=Number(params.get('format'))||501;
const allowedFormats=[170,301,501,1001];
if(!allowedFormats.includes(requestedFormat))return;
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
const E=window.DartArenaLocalH2HEngine;
const B=window.DartArenaBotEngine;
const form=$('localSetupForm'),start=form?.querySelector('button[type=submit]');
if(!form||!db||!E||!B)return;
if(start)start.disabled=true;
const notice=document.createElement('p');notice.className='muted compact';notice.id='aiRivalModelInfo';
form.after(notice);
notice.textContent='Laster AI Rival fra DartArena-historikken…';
let currentSummary=null;
function renderSummary(){
 if(!currentSummary)return;
 const {name,visits,avg,level,checkouts,format}=currentSummary;
 const en=window.DartArenaI18n?.getLanguage?.()==='en';
 notice.textContent=en
 ?'AI Rival: '+name+' · '+visits+' valid 501 visits · historical 3-dart average '+avg.toFixed(2)+' · simulated level '+level.toFixed(2)+' · '+checkouts+' checkouts. The model uses 501 match history'+(format!==501?' to estimate '+format:'')+(format===301?' (Double In estimated from double out)':'')+'. The result is saved locally.'
 :'AI Rival: '+name+' · '+visits+' gyldige 501-runder · historisk 3-dart-snitt '+avg.toFixed(2)+' · simulert nivå '+level.toFixed(2)+' · '+checkouts+' checkouts. Modellen bruker 501-historikk'+(format!==501?' som estimat for '+format:'')+(format===301?' (Double In er estimert fra dobbel-ut)':'')+'. Resultatet lagres lokalt.';
}
document.addEventListener('dartarena:languagechange',renderSummary);
const Model=window.DartArenaRivalModel;
if(!Model)return;
const selector=$('rivalHistoryPlayer');
$('localFormat').value=String(requestedFormat);
if(playerId||params.get('tournamentAiMatch'))$('localFormat').disabled=true;
let loading=false;
async function loadRival(id,{autoStart=false}={}){
 if(loading)return;
 loading=true;
 currentSummary=null;
 if(start)start.disabled=true;
 notice.textContent='Laster spillerhistorikk…';
 try{
  if(!id)throw Error('Velg en DartArena-spiller som AI Rival.');
  const {data:{session},error:authError}=await db.auth.getSession();
  if(authError||!session)throw Error('Logg inn i DartArena for å velge AI Rival.');
  const [{data:player,error:pe},{data:me,error:meError},{data:visits,error:ve}]=await Promise.all([
   db.from('profiles').select('id,username').eq('id',id).single(),
   db.from('profiles').select('username').eq('id',session.user.id).single(),
   db.from('match_throws').select('id,match_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,matches!inner(game,game_variant)').eq('player_id',id).eq('matches.game',501).eq('matches.game_variant','x01').order('id',{ascending:false}).limit(2500)
  ]);
  if(pe||!player?.username)throw Error('Fant ikke spilleren.');
  if(meError)throw Error('Kunne ikke hente din profil.');
  if(ve)throw Error('Kunne ikke lese spillerens registrerte runder.');
  const selectedFormat=Number($('localFormat').value)||requestedFormat;
  const model=Model.build(visits||[],E,{format:selectedFormat,doubleIn:selectedFormat===301});
  window.DartArenaRivalProfile={id,name:player.username};
  B.visit=(remaining,config={})=>model.visit(remaining,{needsDoubleIn:config.doubleInPending===true});
  try{localStorage.setItem('dartarena-ai-rival-501-selected-player',id)}catch{}
  window.dispatchEvent(new Event('dartarena:rival-ready'));
  $('localName1').value=me?.username||'Spiller';
  $('localOpponentType').value='bot';
  $('localOpponentType').dispatchEvent(new Event('change',{bubbles:true}));
  $('localBotMode').value='standard';
  $('localFormat').value=String(selectedFormat);
  $('localMode').value='legs';
  $('localMode').dispatchEvent(new Event('change',{bubbles:true}));
  const best=$('localBestOf');
  if(autoStart&&[...best.options].some(o=>Number(o.value)===requestedLegs))best.value=String(requestedLegs);
  currentSummary={name:player.username,visits:model.historyVisits,avg:model.historyAverage,level:model.estimatedAverage,checkouts:model.historyCheckouts,format:selectedFormat};
  renderSummary();
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
$('localFormat').addEventListener('change',()=>{if(selector.value)loadRival(selector.value);});
init().catch(error=>{notice.textContent=error.message||'Kunne ikke laste spillere.';if(start)start.disabled=true});
})();
