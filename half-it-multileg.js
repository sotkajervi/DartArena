(()=>{
  const currentLegNo=()=>Math.max(1,Number(m?.current_leg||1));
  const currentLegVisits=()=>visits.filter(v=>Number(v.leg_no||1)===currentLegNo());
  const legRoundCount=playerId=>currentLegVisits().filter(v=>v.player_id===playerId).length;

  currentRoundNo=function(){
    if(!m)return 1;
    if(m.status!=='playing')return 12;
    return Math.min(12,legRoundCount(m.turn_player_id)+1);
  };

    renderHistory=function(){
    const body=$('halfHistoryBody');if(!body||!m)return;
    const active=currentRoundNo(),lv=currentLegVisits();
    body.innerHTML=ROUNDS.map((r,i)=>{
      const rn=i+1,a=lv.find(v=>v.player_id===m.player1_id&&v.round_no===rn),b=lv.find(v=>v.player_id===m.player2_id&&v.round_no===rn),label=r.type==='exact'&&(a||b||active>=8)&&state?.exact_target?`Eksakt ${state.exact_target}`:r.history;
      return `<tr class="${m.status==='playing'&&rn===active?'current':''}"><td>${rn}. ${esc(label)}</td><td>${a?Number(a.score_after):'–'}</td><td>${b?Number(b.score_after):'–'}</td></tr>`;
    }).join('');
  };

  render=function(){
    if(!m||!profile)return;
    const c1=legRoundCount(m.player1_id),c2=legRoundCount(m.player2_id),mine=m.turn_player_id===profile.id&&m.status==='playing',rn=currentRoundNo(),r=currentRound(),leg=currentLegNo();
    $('matchFormat').textContent=`HALF-IT (DARTCOUNTER) • BEST OF ${m.legs||1} LEGS • 12 RUNDER/LEG`;
    $('halfName1').textContent=names[m.player1_id]||'Spiller 1';$('halfName2').textContent=names[m.player2_id]||'Spiller 2';window.DartArenaHalfItStarter?.render(m);$('historyName1').textContent=names[m.player1_id]||'Spiller 1';$('historyName2').textContent=names[m.player2_id]||'Spiller 2';
    $('halfScore1').textContent=String(m.player1_score||0);$('halfScore2').textContent=String(m.player2_score||0);
    $('halfRound1').textContent=`${Number(m.player1_legs||0)} legs • ${c1>=12?'12/12 ferdig':`Runde ${c1+1}/12`}`;
    $('halfRound2').textContent=`${Number(m.player2_legs||0)} legs • ${c2>=12?'12/12 ferdig':`Runde ${c2+1}/12`}`;
    $('halfP1').classList.toggle('active',m.status==='playing'&&m.turn_player_id===m.player1_id);$('halfP2').classList.toggle('active',m.status==='playing'&&m.turn_player_id===m.player2_id);$('videoGrid')?.classList.toggle('opponent-throwing',m.status==='playing'&&!mine);
    const formatStrong=document.querySelector('.half-status-list .half-status-row:last-child strong');if(formatStrong)formatStrong.textContent=`Best of ${m.legs||1} legs`;
    const histBadge=document.querySelector('.half-history-head .status');if(histBadge)histBadge.textContent=`Leg ${leg} • 12 runder`;
    if(m.status==='finished'){$('halfRoundLabel').textContent='FERDIG';$('halfTarget').textContent=m.winner_id?`${names[m.winner_id]||'Vinner'} vant`:'Uavgjort';$('halfHelp').textContent=`Slutt: ${m.player1_legs||0}–${m.player2_legs||0} i legs.`;$('turnText').textContent=m.winner_id?`${names[m.winner_id]||'Vinner'} vant`:'Uavgjort';$('matchStatus').textContent='Ferdig'}
    else if(m.status==='cancelled'){$('halfRoundLabel').textContent='AVBRUTT';$('halfTarget').textContent='Kampen er avbrutt';$('halfHelp').textContent='';$('turnText').textContent='Avbrutt';$('matchStatus').textContent='Avbrutt'}
    else{$('halfRoundLabel').textContent=`LEG ${leg} • RUNDE ${rn} AV 12`;$('halfTarget').textContent=r.type==='exact'&&state?.exact_target?`Eksakt ${state.exact_target}`:r.label;$('halfHelp').textContent=r.help;$('turnText').textContent=mine?'Din tur':`${names[m.turn_player_id]||'Motstanderen'} kaster`;$('matchStatus').textContent=`Pågår • Leg ${leg}`}
    const lv=currentLegVisits(),revealExact=m.status!=='playing'||rn>=8||lv.some(v=>v.round_no>=8);$('exactTarget').textContent=revealExact&&state?.exact_target?String(state.exact_target):'Vises i runde 8';$('cancelMatchBtn').classList.toggle('hidden',m.status!=='playing');
    renderEntry();renderHistory();if(m.status==='finished')window.DartArenaResults?.refresh()?.catch(e=>console.warn('Half-It result refresh failed',e));
  };

  const submitHalfItMulti=async()=>{
    if(!canThrow()||!selectedDarts.length||selectedDarts.length>3)return;
    submitting=true;renderEntry();$('matchMessage').textContent='Registrerer…';
    try{
      const darts=Array.from({length:3},(_,i)=>({... (selectedDarts[i]||{n:0,mult:0})})),{data,error}=await db.rpc('submit_half_it_visit',{p_match_id:matchId,p_darts:darts});if(error)throw error;
      selectedDarts=[];selectedMult=1;await refreshGame();
      if(data?.finished)$('matchMessage').textContent=`${names[data.winner_id]||'Vinner'} vant kampen.`;
      else if(data?.leg_finished&&data?.leg_winner_id)$('matchMessage').textContent=`${names[data.leg_winner_id]||'Spiller'} vant leget. Leg ${m.current_leg} starter.`;
      else if(data?.leg_finished)$('matchMessage').textContent=`Leget endte likt. Nytt leg starter.`;
      else $('matchMessage').textContent=data?.success?`+${Number(data.points_scored||0)} poeng`:`Score halvert til ${Number(data?.score_after||0)}`;
      if(m.status==='finished')await setPlayersUnavailable();
    }catch(e){$('matchMessage').textContent=String(e?.message||'Kunne ikke registrere runden.').replace('It is not your turn','Det er ikke din tur.')}finally{submitting=false;renderEntry()}
  };
  $('halfSubmitBtn').onclick=submitHalfItMulti;

  
  if(m)render();
})();
