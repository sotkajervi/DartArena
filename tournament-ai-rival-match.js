/* Online tournament AI Rival result bridge (runs only with ?tournamentAiMatch=).
 * Existing local scoring engine remains unchanged. */
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const fixtureId=params.get('tournamentAiMatch');
const tournamentId=params.get('tournament');
if(!fixtureId||!tournamentId)return;
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
if(!db)return;
const stateKey='dartarena-ai-rival-tournament-state-'+fixtureId;
let fixture=null,me=null,committed=false,expectedFormat=501;
let savePromise=null,initPromise=null;
const note=document.createElement('p');
note.className='muted compact';
note.style.cssText='margin:14px auto;max-width:800px;color:#24d6d0';
note.textContent='Turneringens AI Rival-kamp: resultatet lagres automatisk når kampen er ferdig.';
const host=document.getElementById('localSetup')||document.querySelector('main');
(host||document.body).prepend(note);
const back=document.createElement('a');
back.href='tournament.html?id='+encodeURIComponent(tournamentId);
back.textContent='Tilbake til turnering';
back.style.cssText='display:inline-block;margin:8px;color:#24d6d0';
note.after(back);
async function init(){
 const {data:{session}}=await db.auth.getSession();
 if(!session)throw Error('Logg inn for å spille turneringskamp.');
 me=session.user.id;
 const {data,error}=await db.from('tournament_ai_group_matches').select('id,tournament_id,human_id,status,best_of').eq('id',fixtureId).eq('tournament_id',tournamentId).single();
 if(error||!data)throw Error('AI-kampen ble ikke funnet.');
 if(data.human_id!==me)throw Error('Bare spilleren som er satt opp mot AI kan spille denne kampen.');
 const {data:config,error:configError}=await db.from('tournament_ai_rivals').select('model_player_id').eq('tournament_id',tournamentId).single();
 if(configError||!config||params.get('player')!==config.model_player_id)throw Error('Feil AI Rival er valgt for denne turneringen.');
 const {data:tour,error:tourError}=await db.from('tournaments').select('game,game_variant').eq('id',tournamentId).single();
 if(tourError||!tour||tour.game_variant!=='x01'||![170,501,1001].includes(Number(tour.game)))throw Error('Denne turneringens spillformat er ikke støttet av AI Rival.');
 expectedFormat=Number(tour.game);
 if(Number(params.get('format')||501)!==expectedFormat)throw Error('AI-kampens spillformat stemmer ikke med turneringen.');
 fixture=data;
 if(data.status==='finished'){
  committed=true;
  note.textContent='Denne AI-kampen er allerede ferdig og resultatet er registrert.';
  return;
 }
 if(params.get('legs')!==String(data.best_of))throw Error('Kampformatet stemmer ikke med turneringen.');
}
async function save(){
 if(committed)return true;
 if(!fixture)return false;
 if(savePromise)return savePromise;
 let state;try{state=JSON.parse(localStorage.getItem(stateKey)||'null')}catch{return false}
 if(!state||state.status!=='finished'||!Array.isArray(state.legs)||Number(state.format)!==expectedFormat||state.doubleIn===true)return false;
 let linked;try{linked=JSON.parse(localStorage.getItem('dartarena-ai-rival-tournament-session')||'null')}catch{}
 if(linked?.fixtureId!==fixtureId||linked?.stateId!==state.id)return false;
 if(state.mode!=='legs'||Number(state.bestOf)!==Number(fixture.best_of))return false;
 if(!Array.isArray(state.visits)||!state.visits.some(v=>v.player===0)||!state.visits.some(v=>v.player===1))return false;
 const [human,ai]=state.legs.map(Number);
 savePromise=(async()=>{
  note.textContent='Kampen er ferdig. Lagrer resultatet i turneringen…';
  try{
   const {error}=await db.rpc('finish_tournament_ai_group_match',{p_ai_match_id:fixture.id,p_human_legs:human,p_ai_legs:ai});
   if(error)throw error;
   committed=true;
   note.textContent='Resultatet er registrert i turneringen: '+human+'–'+ai+'.';
   back.textContent='Se puljetabellen';
   const overlayNote=document.querySelector('#dartArenaResultOverlay .da-result-note');
   if(overlayNote)overlayNote.textContent='Resultat registrert i turneringen: '+human+'–'+ai+'.';
   return true;
  }catch(error){
   note.textContent='Resultatet kunne ikke lagres: '+(error.message||String(error))+'. Prøv igjen.';
   const overlayNote=document.querySelector('#dartArenaResultOverlay .da-result-note');
   if(overlayNote)overlayNote.textContent=note.textContent;
   return false;
  }
 })().finally(()=>{savePromise=null});
 return savePromise;
}
async function returnToTournament(){
 const button=document.getElementById('daLocalResultLobby');
 if(button)button.disabled=true;
 try{
  await initPromise;
  let state;try{state=JSON.parse(localStorage.getItem(stateKey)||'null')}catch{}
  if(state?.status==='finished'&&!committed){
   if(!await save()){
    note.textContent='Kan ikke gå tilbake før kampresultatet er registrert. Kontroller meldingen og prøv igjen.';
    return;
   }
  }
  location.assign(back.href);
 }catch(error){
  note.textContent='Kunne ikke bekrefte turneringsresultatet: '+(error.message||String(error));
 }finally{
  if(button)button.disabled=false;
 }
}
window.DartArenaTournamentAiMatch={returnToTournament};
back.addEventListener('click',event=>{event.preventDefault();returnToTournament()});
window.addEventListener('dartarena:practice-save',()=>{save().catch(e=>{note.textContent=e.message||String(e)})});
initPromise=init();
initPromise.then(save).catch(e=>{note.textContent=e.message||String(e)});
})();
