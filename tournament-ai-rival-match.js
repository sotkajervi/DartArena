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
let fixture=null,me=null,saving=false,committed=false;
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
 fixture=data;
 if(data.status==='finished'){
  committed=true;
  note.textContent='Denne AI-kampen er allerede ferdig og resultatet er registrert.';
  return;
 }
 if(params.get('legs')!==String(data.best_of))throw Error('Kampformatet stemmer ikke med turneringen.');
}
async function save(){
 if(!fixture||committed||saving)return;
 let state;try{state=JSON.parse(localStorage.getItem(stateKey)||'null')}catch{return}
 if(!state||state.status!=='finished'||!Array.isArray(state.legs)||Number(state.format)!==501)return;
 let linked;try{linked=JSON.parse(localStorage.getItem('dartarena-ai-rival-tournament-session')||'null')}catch{}
 if(linked?.fixtureId!==fixtureId||linked?.stateId!==state.id)return;
 if(state.mode!=='legs'||Number(state.bestOf)!==Number(fixture.best_of))return;
 if(!Array.isArray(state.visits)||!state.visits.some(v=>v.player===0)||!state.visits.some(v=>v.player===1))return;
 saving=true;note.textContent='Kampen er ferdig. Lagrer resultatet i turneringen…';
 const [human,ai]=state.legs.map(Number);
 const {error}=await db.rpc('finish_tournament_ai_group_match',{p_ai_match_id:fixture.id,p_human_legs:human,p_ai_legs:ai});
 if(error){note.textContent='Resultatet kunne ikke lagres: '+error.message+'. Prøv å oppdatere siden.';saving=false;return}
 committed=true;note.textContent='Resultatet er registrert i turneringen: '+human+'–'+ai+'.';
 back.textContent='Se puljetabellen';
}
window.addEventListener('dartarena:practice-save',save);
init().then(save).catch(e=>{note.textContent=e.message});
})();
