/* Tournament AI Rival selection. Configuration is persisted separately from
 * auth.users; do not create phantom tournament_matches before bot support. */
(function(){
 'use strict';
 const panel=document.getElementById('aiRivalSetup');
 if(!panel)return;
 const select=document.getElementById('aiRivalModel');
 const add=document.getElementById('aiRivalAdd');
 const remove=document.getElementById('aiRivalRemove');
 const status=document.getElementById('aiRivalStatus');
 let selected=null;
 let busy=false;
 let lastError='';
 function syncDraw(){
   const name=select.selectedOptions[0]?.textContent||'Spiller';
   window.DartArenaSelectedAIRival=selected?{model_player_id:selected,name}:null;
   try{drawnGroups=null;renderSetup()}catch{}
 }
 function refresh(){
   const selectedGame=document.getElementById('tournamentGame')?.value||String(tournament?.game||501);
   const supported=['170','501','1001'].includes(selectedGame);
   const active=!!tournament&&tournament.owner_id===me&&tournament.status==='groups_setup'&&tournament.tournament_type==='groups_cup';
   panel.classList.toggle('hidden',!active);
   add.disabled=busy||!active||!supported||!select.value||!!selected;
   remove.disabled=busy||!active||!selected;
   select.disabled=busy||!!selected;
   status.textContent=lastError?lastError:!supported?'AI Rival i puljer krever 170, 501 eller 1001. 301 DI/DO er foreløpig bare tilgjengelig som egen AI-kamp.':selected?'Valgt AI Rival: '+(select.selectedOptions[0]?.textContent||'Spiller')+'. Puljetrekkingen inkluderer AI Rival.':'Velg en spiller AI Rival skal etterligne. AI Rival deltar i puljespillet og gir WO i cup.';
 }
 async function loadSelection(){
  if(!tournament||tournament.status!=='groups_setup'){panel.classList.add('hidden');return;}
  const [profiles,choice]=await Promise.all([
   db.from('profiles').select('id,username').order('username'),
   db.from('tournament_ai_rivals').select('model_player_id').eq('tournament_id',id).maybeSingle()
  ]);
  if(profiles.error||choice.error){status.textContent='Kunne ikke hente AI Rival-valg: '+(profiles.error||choice.error).message;return;}
  const options=(profiles.data||[]).filter(p=>p.id&&p.username);
  select.replaceChildren(new Option('Velg spiller…',''),...options.map(p=>new Option(p.username,p.id)));
  selected=choice.data?.model_player_id||null;
  if(selected)select.value=selected;
  syncDraw();refresh();
 }
 async function mutate(op){
  if(busy||tournament?.owner_id!==me||tournament?.status!=='groups_setup')return;
  busy=true;lastError='';refresh();
  try{
   if(op==='add'){
    if(!['170','501','1001'].includes(document.getElementById('tournamentGame')?.value||String(tournament?.game||501)))throw Error('AI Rival er tilgjengelig i 170, 501 og 1001-puljer.');
    if(!select.value)throw Error('Velg en spiller først.');
    const {count,error:historyError}=await db.from('match_throws').select('id',{count:'exact',head:true}).eq('player_id',select.value).eq('is_checkout',false);
    if(historyError)throw Error('Kunne ikke kontrollere spillerhistorikken: '+historyError.message);
    if(Number(count||0)<30)throw Error('Spilleren må ha minst 30 registrerte kasterunder for AI Rival.');
    const {error}=await db.from('tournament_ai_rivals').insert({tournament_id:id,model_player_id:select.value,created_by:me});
    if(error)throw error;
    selected=select.value;
    syncDraw();
   }else{
    const {error}=await db.from('tournament_ai_rivals').delete().eq('tournament_id',id);
    if(error)throw error;
    selected=null;
    syncDraw();
   }
  }catch(e){lastError='Kunne ikke lagre: '+(e.message||e);return;}
  finally{busy=false;refresh();}
 }
 select.addEventListener('change',refresh);
 document.addEventListener('change',event=>{if(event.target?.id==='tournamentGame')refresh()});
 add.addEventListener('click',()=>mutate('add'));
 remove.addEventListener('click',()=>mutate('remove'));
 function openAiMatch(row){
  if(!row||row.dataset.aiStatus!=='pending'||tournament?.status!=='groups')return;
  if(row.dataset.aiHuman!==me){
   if(window.DartArenaDialog?.alert)window.DartArenaDialog.alert('Bare spilleren som er satt opp mot AI Rival kan starte denne kampen.',{title:'AI Rival'});
   return;
  }
  const match=row.dataset.aiMatch,model=row.dataset.aiModel,legs=Number(row.dataset.aiBestOf);
  const format=Number(tournament?.game);
  if(!match||!model||!Number.isInteger(legs)||legs<1||![170,501,1001].includes(format))return;
  location.assign('ai-rival-501.html?player='+encodeURIComponent(model)+'&format='+encodeURIComponent(format)+'&legs='+encodeURIComponent(legs)+'&tournament='+encodeURIComponent(id)+'&tournamentAiMatch='+encodeURIComponent(match));
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('.ai-rival-start-btn');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  openAiMatch(button.closest('.match-row[data-ai-match]'));
 });
 window.addEventListener('dartarena:tournament-loaded',loadSelection);
})();
