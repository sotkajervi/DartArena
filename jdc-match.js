(()=>{
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);
  const matchId=new URLSearchParams(location.search).get('id');
  const TIER_LABELS={white:'White',purple:'Purple',yellow:'Yellow',green:'Green',blue:'Blue',red:'Red',black:'Black',gold:'Gold'};
  const HIT_LABELS={M:'Bom',S:'Single',D:'Double',T:'Triple',H:'Treff'};
  let session=null,match=null,turns=[],names={},pendingCodes=[],pendingTurnNo=null,busy=false,pollTimer=null;

  const badgeFor=score=>score>=1250?'gold':score>=850?'black':score>=700?'red':score>=600?'blue':score>=450?'green':score>=300?'yellow':score>=150?'purple':'white';
  const countFor=id=>turns.filter(t=>t.player_id===id).length;
  const myId=()=>session?.user?.id;
  const otherId=()=>match?(myId()===match.player1_id?match.player2_id:match.player1_id):null;
  const isMyTurn=()=>match?.status==='playing'&&match.turn_player_id===myId();
  const currentTurnNo=()=>{
    if(!match)return 1;
    const id=match.turn_player_id||match.player1_id;
    return Math.min(33,countFor(id)+1);
  };
  const myNextTurnNo=()=>Math.min(33,countFor(myId())+1);
  const doubleTargetFor=turnNo=>turnNo===27?'BULL':`D${turnNo-6}`;
  function doubleBlockFor(turnNo){
    const blockStart=7+Math.floor((turnNo-7)/3)*3;
    const blockEnd=Math.min(27,blockStart+2);
    const first=Math.max(turnNo,blockStart);
    const targets=[];
    for(let n=first;n<=blockEnd;n++)targets.push(doubleTargetFor(n));
    return{blockStart,blockEnd,first,targets,max:targets.length};
  }
  function positionFor(turnNo){
    if(turnNo<=6)return{kind:'shanghai',phase:'FASE 1 • SHANGHAI 10–15',target:String(9+turnNo),max:3};
    if(turnNo<=27){const block=doubleBlockFor(turnNo);return{kind:'double',phase:'FASE 2 • DOUBLES',target:block.targets[0],max:block.max,...block};}
    return{kind:'shanghai',phase:'FASE 3 • SHANGHAI 15–20',target:String(turnNo-13),max:3};
  }
  function clearSelected(){document.querySelectorAll('.jdc-online-actions button').forEach(b=>b.classList.remove('jdc-selected'))}
  function selectLast(){
    clearSelected();
    if(!pendingCodes.length)return;
    const pos=positionFor(currentTurnNo());
    const last=pendingCodes[pendingCodes.length-1];
    const map=pos.kind==='double'?{M:'doubleMissBtn',H:'doubleHitBtn'}:{M:'missBtn',S:'singleBtn',D:'doubleBtn',T:'tripleBtn'};
    $(map[last])?.classList.add('jdc-selected');
  }
  function setMessage(text=''){$('matchMessage').textContent=text}
  function setStableText(id,text){const el=$(id);if(el&&el.textContent!==text)el.textContent=text}
  function goLobby(){
    try{window.opener?.postMessage({type:'dartarena-match-ended',id:matchId},location.origin)}catch{}
    window.close();
    setTimeout(()=>{if(!window.closed)location.href='./'},150);
  }

  async function refresh(){
    if(!matchId)return location.replace('./');
    const [{data:m,error:me},{data:t,error:te}]=await Promise.all([
      db.from('matches').select('*').eq('id',matchId).maybeSingle(),
      db.from('jdc_match_turns').select('id,match_id,player_id,turn_no,hits,points,shanghai_bonus,created_at').eq('match_id',matchId).order('turn_no').order('created_at')
    ]);
    if(me||te||!m)throw me||te||new Error('Kampen finnes ikke.');
    if(m.game_variant!=='jdc'||![m.player1_id,m.player2_id].includes(myId()))return location.replace('./');
    match=m;turns=t||[];
    if(!Object.keys(names).length){
      const {data:p}=await db.from('profiles').select('id,username').in('id',[m.player1_id,m.player2_id]);
      names=Object.fromEntries((p||[]).map(x=>[x.id,x.username]));
    }
    render();
  }

  function render(){
    if(!match)return;
    const p1=countFor(match.player1_id),p2=countFor(match.player2_id),mine=isMyTurn(),activeTurnNo=currentTurnNo(),displayTurnNo=mine?activeTurnNo:myNextTurnNo(),pos=positionFor(displayTurnNo);
    setStableText('matchPlayer1Name',names[match.player1_id]||'Spiller 1');
    setStableText('matchPlayer2Name',names[match.player2_id]||'Spiller 2');
    setStableText('player1Name',names[match.player1_id]||'Spiller 1');
    setStableText('player2Name',names[match.player2_id]||'Spiller 2');
    $('player1Score').textContent=String(match.player1_score||0);
    $('player2Score').textContent=String(match.player2_score||0);
    $('player1Progress').textContent=`${p1}/33 mål`;
    $('player2Progress').textContent=`${p2}/33 mål`;
    $('player1Card').classList.toggle('active',match.status==='playing'&&match.turn_player_id===match.player1_id);
    $('player2Card').classList.toggle('active',match.status==='playing'&&match.turn_player_id===match.player2_id);

    if(match.status==='finished'){
      pendingCodes=[];pendingTurnNo=null;clearSelected();
      $('phaseTitle').textContent='KAMP FERDIG';$('targetValue').textContent='✓';$('dartMeta').textContent='66 mål registrert totalt';
      setStableText('turnText',match.winner_id?`${names[match.winner_id]||'Vinner'} vant`:'Uavgjort');
      $('shanghaiActions').classList.add('hidden');$('doubleActions').classList.add('hidden');$('undoBtn').disabled=true;
      $('confirmTurnBtn').disabled=false;$('confirmTurnBtn').innerHTML='Lukk kampfane <span class="da-key">Enter</span>';
      $('cancelMatchBtn').classList.add('hidden');$('closeMatchBtn').classList.remove('hidden');$('closeMatchBtn').textContent='Lukk kampfane';$('finishedBox').classList.remove('hidden');
      $('winnerText').textContent=match.winner_id?`${names[match.winner_id]||'Vinner'} vinner ${match.player1_score}–${match.player2_score}`:`Uavgjort ${match.player1_score}–${match.player2_score}`;
      const mineScore=myId()===match.player1_id?Number(match.player1_score||0):Number(match.player2_score||0),badge=badgeFor(mineScore);
      $('tierText').textContent=`Din offisielle score: ${mineScore} • ${TIER_LABELS[badge]} tier`;
      return;
    }
    if(match.status==='cancelled'){
      pendingCodes=[];pendingTurnNo=null;clearSelected();
      $('phaseTitle').textContent='AVBRUTT';$('targetValue').textContent='–';$('dartMeta').textContent='Kampen er avbrutt';setStableText('turnText','Avbrutt');
      $('shanghaiActions').classList.add('hidden');$('doubleActions').classList.add('hidden');$('undoBtn').disabled=true;
      $('cancelMatchBtn').classList.add('hidden');$('closeMatchBtn').classList.remove('hidden');$('closeMatchBtn').textContent='Til lobby';
      return;
    }

    $('cancelMatchBtn').classList.remove('hidden');$('closeMatchBtn').classList.add('hidden');
    if(pendingTurnNo!==activeTurnNo||!mine){pendingCodes=[];pendingTurnNo=mine?activeTurnNo:null;clearSelected()}
    $('phaseTitle').textContent=pos.phase;
    if(pos.kind==='double'){
      const targetIndex=mine?Math.min(pendingCodes.length,pos.targets.length-1):0;
      $('targetValue').textContent=pos.targets[targetIndex];
    }else $('targetValue').textContent=pos.target;
    setStableText('turnText',mine?'Din tur':`${names[match.turn_player_id]||'Motstanderen'} kaster`);
    if(mine&&pos.kind==='shanghai'){
      $('dartMeta').textContent=`Pil ${Math.min(3,pendingCodes.length+1)} av 3 • mål ${activeTurnNo}/33`;
    }else if(mine&&pos.kind==='double'){
      const first=doubleTargetFor(pos.first),last=doubleTargetFor(pos.blockEnd);
      $('dartMeta').textContent=`Pil ${Math.min(pos.max,pendingCodes.length+1)} av ${pos.max} • blokk ${first}–${last}`;
    }else{
      $('dartMeta').textContent=`Neste for deg • mål ${displayTurnNo}/33 • venter på motstander`;
    }
    $('shanghaiActions').classList.toggle('hidden',pos.kind!=='shanghai');
    $('doubleActions').classList.toggle('hidden',pos.kind!=='double');
    document.querySelectorAll('#shanghaiActions button,#doubleActions button').forEach(b=>b.disabled=!mine||busy||pendingCodes.length>=pos.max);
    $('undoBtn').disabled=busy||(!pendingCodes.length&&!turns.some(t=>t.player_id===myId()));
    selectLast();
    if(pendingCodes.length){
      const selected=pendingCodes.map((c,i)=>pos.kind==='double'?`${pos.targets[i]}: ${HIT_LABELS[c]||c}`:(HIT_LABELS[c]||c)).join(' • ');
      setMessage(`Valgt: ${selected}${pos.kind==='double'&&pendingCodes.length<pos.max?'':' • Enter registrerer'}`);
    }else if(!busy&&$('matchMessage').textContent.startsWith('Valgt:'))setMessage('');
  }

  function queueShanghai(code){
    if(!isMyTurn()||busy)return;
    const pos=positionFor(currentTurnNo());if(pos.kind!=='shanghai'||pendingCodes.length>=3)return;
    pendingTurnNo=currentTurnNo();pendingCodes.push(code);render();
  }
  function queueDouble(code){
    if(!isMyTurn()||busy)return;
    const pos=positionFor(currentTurnNo());if(pos.kind!=='double'||pendingCodes.length>=pos.max)return;
    pendingTurnNo=currentTurnNo();pendingCodes.push(code);render();
  }
  async function submitHits(codes){
    if(!isMyTurn()||busy)return;
    busy=true;setMessage('Registrerer…');render();
    const {error}=await db.rpc('submit_jdc_match_turn',{p_match_id:matchId,p_hits:codes});
    busy=false;
    if(error){setMessage(error.message||'Kunne ikke registrere.');render();return}
    pendingCodes=[];pendingTurnNo=null;setMessage('Registrert.');await refresh();
  }
  function commitShanghai(){
    if(!isMyTurn()||!pendingCodes.length)return;
    const codes=[...pendingCodes];while(codes.length<3)codes.push('M');submitHits(codes);
  }
  function commitDouble(){
    if(!isMyTurn())return;
    const pos=positionFor(currentTurnNo());
    if(pos.kind!=='double'||pendingCodes.length!==pos.max){setMessage(`Registrer alle ${pos.max} pilene før Enter.`);return}
    submitHits([...pendingCodes]);
  }
  async function undo(){
    if(busy)return;
    if(pendingCodes.length){pendingCodes.pop();render();return}
    busy=true;setMessage('Angrer…');render();
    const {error}=await db.rpc('undo_jdc_match_turn',{p_match_id:matchId});
    busy=false;
    if(error){setMessage(error.message||'Kunne ikke angre.');render();return}
    setMessage('Siste registrering er angret.');await refresh();
  }

  function keydown(event){
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    const tag=event.target?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||event.target?.isContentEditable)return;
    if(event.key==='Enter'&&match?.status==='finished'){event.preventDefault();goLobby();return}
    if(event.key==='Backspace'){event.preventDefault();undo();return}
    if(!isMyTurn()||busy)return;
    const pos=positionFor(currentTurnNo());
    if(event.key==='Enter'){
      event.preventDefault();
      if(pos.kind==='shanghai')commitShanghai();else commitDouble();
      return;
    }
    if(pos.kind==='double'){
      if(event.key==='0'){event.preventDefault();queueDouble('M')}
      else if(event.key==='2'){event.preventDefault();queueDouble('H')}
      return;
    }
    const code=event.key==='0'?'M':event.key==='1'?'S':event.key==='2'?'D':event.key==='3'?'T':null;
    if(code){event.preventDefault();queueShanghai(code)}
  }

  async function boot(){
    const {data:{session:s}}=await db.auth.getSession();session=s;if(!session)return location.replace('./');
    $('missBtn').onclick=()=>queueShanghai('M');$('singleBtn').onclick=()=>queueShanghai('S');$('doubleBtn').onclick=()=>queueShanghai('D');$('tripleBtn').onclick=()=>queueShanghai('T');
    $('doubleMissBtn').onclick=()=>queueDouble('M');$('doubleHitBtn').onclick=()=>queueDouble('H');$('undoBtn').onclick=undo;
    $('closeMatchBtn').onclick=goLobby;
    document.addEventListener('keydown',keydown);
    await refresh();
    pollTimer=setInterval(()=>refresh().catch(()=>{}),900);
  }
  window.addEventListener('pagehide',()=>clearInterval(pollTimer));
  boot().catch(error=>{console.error('JDC online failed',error);setMessage(error?.message||'Kunne ikke starte JDC-kampen.')});
})();