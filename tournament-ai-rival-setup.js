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
 function refresh(){
   const active=!!tournament&&tournament.owner_id===me&&tournament.status==='groups_setup'&&tournament.tournament_type==='groups_cup';
   panel.classList.toggle('hidden',!active);
   add.disabled=busy||!active||!select.value||!!selected;
   remove.disabled=busy||!active||!selected;
   select.disabled=busy||!!selected;
   status.textContent=selected?'Valgt AI Rival: '+(select.selectedOptions[0]?.textContent||'Spiller')+'. AI-kampintegrasjonen er ikke aktivert ennå.':'Velg en spiller AI Rival skal etterligne. Dette reserverer valget, men legger ikke AI til puljetrekningen ennå.';
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
  refresh();
 }
 async function mutate(op){
  if(busy||tournament?.owner_id!==me||tournament?.status!=='groups_setup')return;
  busy=true;refresh();
  try{
   if(op==='add'){
    if(!select.value)throw Error('Velg en spiller først.');
    const {error}=await db.from('tournament_ai_rivals').insert({tournament_id:id,model_player_id:select.value,created_by:me});
    if(error)throw error;
    selected=select.value;
   }else{
    const {error}=await db.from('tournament_ai_rivals').delete().eq('tournament_id',id);
    if(error)throw error;
    selected=null;
   }
  }catch(e){status.textContent='Kunne ikke lagre: '+(e.message||e);return;}
  finally{busy=false;refresh();}
 }
 select.addEventListener('change',refresh);
 add.addEventListener('click',()=>mutate('add'));
 remove.addEventListener('click',()=>mutate('remove'));
 window.addEventListener('dartarena:tournament-loaded',loadSelection);
})();
