(()=>{
  if(typeof state==='undefined'||typeof currentRound!=='function'||!document.getElementById('halfPad'))return;

  let selectedExactTarget=null;
  let exactKey='';
  const baseBuildPad=buildPad;
  const baseRenderEntry=renderEntry;
  const baseRender=render;
  const baseRenderHistory=renderHistory;
  const baseSubmit=document.getElementById('halfSubmitBtn').onclick;

  const options=()=>{
    const arr=Array.isArray(state?.exact_options)?state.exact_options.map(Number).filter(Number.isFinite):[];
    if(arr.length===3)return arr;
    return state?.exact_target?[Number(state.exact_target)]:[];
  };
  const key=()=>`${Number(m?.current_leg||1)}:${m?.turn_player_id||''}:${currentRoundNo()}`;
  const syncKey=()=>{const k=key();if(k!==exactKey){exactKey=k;selectedExactTarget=null;}};
  const isExact=()=>currentRound()?.type==='exact'&&m?.status==='playing';

  buildPad=function(){
    syncKey();
    if(!isExact())return baseBuildPad();
    const host=$('halfPad');
    const opts=options();
    const mine=m.turn_player_id===profile?.id;
    if(!mine){
      host.innerHTML=`<div class="half-exact-wait"><small>3 MÅLTALL</small><strong>${opts.join(' / ')||'–'}</strong><span>${esc(names[m.turn_player_id]||'Motstanderen')} velger ett mål</span></div>`;
      return;
    }
    if(!selectedExactTarget){
      host.innerHTML=`<div class="half-exact-choice"><small>VELG ETT MÅLTALL</small><div class="half-exact-options">${opts.map(n=>`<button type="button" class="outline half-exact-option" data-target="${n}">${n}</button>`).join('')}</div><p>Velg målet før du registrerer de tre pilene.</p></div>`;
      host.querySelectorAll('.half-exact-option').forEach(b=>b.onclick=()=>{selectedExactTarget=Number(b.dataset.target);selectedDarts=[];renderEntry();render()});
      return;
    }
    baseBuildPad();
    const bar=document.createElement('div');
    bar.className='half-exact-selected';
    bar.innerHTML=`<span>VALGT MÅL <strong>${selectedExactTarget}</strong></span><button type="button" class="outline">Bytt mål</button>`;
    bar.querySelector('button').disabled=selectedDarts.length>0;
    bar.querySelector('button').onclick=()=>{if(selectedDarts.length)return;selectedExactTarget=null;renderEntry();render()};
    host.prepend(bar);
  };

  renderEntry=function(){
    syncKey();
    baseRenderEntry();
    if(isExact()&&m.turn_player_id===profile?.id&&!selectedExactTarget){
      $('halfMissBtn').disabled=true;
      $('halfSubmitBtn').disabled=true;
    }
  };

  renderHistory=function(){
    baseRenderHistory();
    const body=$('halfHistoryBody');
    if(!body||!m)return;
    const leg=Math.max(1,Number(m.current_leg||1));
    const lv=visits.filter(v=>Number(v.leg_no||1)===leg);
    const a=lv.find(v=>v.player_id===m.player1_id&&v.round_no===8);
    const b=lv.find(v=>v.player_id===m.player2_id&&v.round_no===8);
    const row=body.querySelector('tr:nth-child(8)');
    if(!row)return;
    const cells=row.querySelectorAll('td');
    if(cells[0])cells[0].textContent='8. Eksakt score';
    if(a&&cells[1])cells[1].innerHTML=`${Number(a.score_after)}<small class="half-history-target">mål ${Number(a.exact_target||state?.exact_target||0)}</small>`;
    if(b&&cells[2])cells[2].innerHTML=`${Number(b.score_after)}<small class="half-history-target">mål ${Number(b.exact_target||state?.exact_target||0)}</small>`;
  };

  render=function(){
    syncKey();
    baseRender();
    if(!isExact())return;
    const opts=options();
    const mine=m.turn_player_id===profile?.id;
    $('halfTarget').textContent=mine?(selectedExactTarget?`Eksakt ${selectedExactTarget}`:'Velg måltall'):`Eksakt: ${opts.join(' / ')}`;
    $('halfHelp').textContent=mine
      ?(selectedExactTarget?`Tre piler skal gi nøyaktig ${selectedExactTarget}.`:'Velg ett av de tre måltallene. Deretter skal de tre pilene gi nøyaktig den summen.')
      :`${names[m.turn_player_id]||'Motstanderen'} velger ett av de tre målene og skal treffe summen nøyaktig.`;
    if($('exactTarget'))$('exactTarget').textContent=selectedExactTarget?`Valgt ${selectedExactTarget} • ${opts.join(' / ')}`:opts.join(' / ');
    renderEntry();
  };

  $('halfSubmitBtn').onclick=async()=>{
    syncKey();
    if(!isExact())return baseSubmit?.();
    if(!canThrow()||selectedDarts.length!==3||!selectedExactTarget)return;
    submitting=true;renderEntry();$('matchMessage').textContent='Registrerer…';
    try{
      const darts=selectedDarts.map((d,i)=>i===0?{...d,exact_target:selectedExactTarget}:{...d});
      const{data,error}=await db.rpc('submit_half_it_visit',{p_match_id:matchId,p_darts:darts});
      if(error)throw error;
      selectedDarts=[];selectedMult=1;selectedExactTarget=null;await refreshGame();
      if(data?.finished)$('matchMessage').textContent=`${names[data.winner_id]||'Vinner'} vant kampen.`;
      else if(data?.leg_finished&&data?.leg_winner_id)$('matchMessage').textContent=`${names[data.leg_winner_id]||'Spiller'} vant leget. Leg ${m.current_leg} starter.`;
      else if(data?.leg_finished)$('matchMessage').textContent='Leget endte likt. Nytt leg starter.';
      else $('matchMessage').textContent=data?.success?`Eksakt ${Number(data.exact_target)} satt • +${Number(data.points_scored||0)} poeng`:`Bom på eksakt ${Number(data.exact_target)} • score halvert til ${Number(data?.score_after||0)}`;
      if(m.status==='finished')await setPlayersUnavailable();
    }catch(e){$('matchMessage').textContent=String(e?.message||'Kunne ikke registrere runden.').replace('Choose one of the three exact targets','Velg ett av de tre måltallene.').replace('It is not your turn','Det er ikke din tur.')}finally{submitting=false;renderEntry()}
  };

  if(m)render();
})();
