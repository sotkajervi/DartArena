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
 const normal=visits.filter(v=>!v.is_checkout&&Number.isInteger(v.score)&&v.score>=0&&v.score<=180);
 const checkouts=visits.filter(v=>v.is_checkout&&Number.isInteger(v.score));
 return {normal:normal.map(v=>v.score),checkoutCount:checkouts.length,total:visits.length};
}
function makeVisit(remaining,model){
 const options=E.checkoutOptions(remaining);
 const likelihood=Math.min(.52,Math.max(.012,(model.checkoutCount/Math.max(1,model.total))*(remaining<=40?4.3:remaining<=80?2.5:1.3)));
 if(options.length&&Math.random()<likelihood){
  return {score:remaining,bust:false,checkout:true,darts:pick(options),throws:[]};
 }
 for(let i=0;i<48;i++){
  const score=pick(model.normal);
  if(Number.isInteger(score)&&E.validScore(score)&&score<=remaining-2)
   return {score,bust:false,checkout:false,darts:3,throws:[]};
 }
 return {score:0,bust:false,checkout:false,darts:3,throws:[]};
}
async function init(){
 if(!playerId||!(/^[0-9a-f-]{36}$/i.test(playerId)))throw Error('Velg en spiller fra AI Rival-siden.');
 const {data:{session}}=await db.auth.getSession();
 if(!session)throw Error('Du må være innlogget i DartArena.');
 const [{data:player,error:pe},{data:me,error:meError},{data:visits,error:ve}]=await Promise.all([
   db.from('profiles').select('id,username').eq('id',playerId).single(),
   db.from('profiles').select('username').eq('id',session.user.id).single(),
   db.from('match_throws').select('score,is_checkout').eq('player_id',playerId).order('id',{ascending:false}).limit(2500)
 ]);
 if(pe||!player?.username)throw Error('Fant ikke spilleren.');
 if(meError)throw Error('Kunne ikke hente din profil.');
 if(ve)throw Error('Kunne ikke lese spillerens registrerte runder.');
 const model=makeModel(visits||[]);
 if(model.normal.length<30)throw Error('Spilleren har for få registrerte kasterunder til AI Rival.');
 window.DartArenaRivalProfile={id:playerId,name:player.username};
 B.visit=(remaining)=>makeVisit(remaining,model);
 try{localStorage.setItem('dartarena-ai-rival-501-selected-player',playerId)}catch{}
 window.dispatchEvent(new Event('dartarena:rival-ready'));
 $('localName1').value=me?.username||'Spiller';
 $('localOpponentType').value='bot';
 $('localOpponentType').dispatchEvent(new Event('change',{bubbles:true}));
 $('localBotMode').value='standard';
 $('localBotAverage').value='55';
 $('localBotProfile').value='steady';
 $('localFormat').value='501';
 $('localMode').value='legs';
 $('localMode').dispatchEvent(new Event('change',{bubbles:true}));
 const best=$('localBestOf');
 if([...best.options].some(o=>Number(o.value)===requestedLegs))best.value=String(requestedLegs);
 $('localStarter').value='0';
 notice.textContent='AI: '+player.username+' · '+model.total+' historiske kasterunder. Standard 501-regler, dobbel-ut, statistikk og korrigering. Resultatene er lokale.';
 // Existing standard setup form remains the source of truth for rules and scoring.
 if(start)start.disabled=false;
 // Auto-start when the user came from AI Rival player selection and no match is already open.
 if($('localGame')?.hidden)form.requestSubmit();
}
init().catch(error=>{notice.textContent=error.message||'Kunne ikke laste AI Rival.';if(start)start.disabled=true});
})();