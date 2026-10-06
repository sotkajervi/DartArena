// DartArena Cricket: keyboard-first mark entry, visit log and last-visit correction.
(()=>{
  let visits=[],editingVisitId=null,logChannel=null,ready=false;
  const isChicago=()=>String(m?.game_config?.chicago??'false').toLowerCase()==='true';
  const TARGETS=['20','19','18','17','16','15','B'];
  const KEY_TARGETS={'0':'20','9':'19','8':'18','7':'17','6':'16','5':'15','b':'B'};
  const baseRender=render;

  const normalizeTarget=t=>{const x=String(t||'').toUpperCase();return x==='BULL'?'B':x};
  function aggregate(items=[]){
    const counts=Object.fromEntries(TARGETS.map(t=>[t,0]));let misses=0;
    for(const d of items){const target=normalizeTarget(d?.target);if(target==='MISS')misses++;else if(target in counts)counts[target]+=Math.max(1,Number(d?.mult)||1)}
    return{counts,misses};
  }
  function pack(items=[]){
    const{counts,misses}=aggregate(items),out=[];
    for(const target of TARGETS){let left=counts[target],max=target==='B'?2:3;while(left>0){const mult=Math.min(max,left);out.push({target,mult});left-=mult}}
    for(let i=0;i<misses;i++)out.push({target:'MISS',mult:0});
    if(out.length>3)throw new Error('Dette krever mer enn tre piler.');
    return out;
  }
  function expand(darts=[]){
    const out=[];
    for(const d of darts||[]){const target=normalizeTarget(d?.target),mult=Number(d?.mult)||0;if(target==='MISS'){out.push({target:'MISS',mult:0});continue}for(let i=0;i<mult;i++)out.push({target,mult:1})}
    return out;
  }
  function summary(items=[]){
    const{counts,misses}=aggregate(items),parts=[];
    for(const t of TARGETS)if(counts[t])parts.push(`${t==='B'?'Bull':t}×${counts[t]}`);
    if(misses)parts.push(`Miss×${misses}`);
    return parts.join(' · ')||'Ingen treff';
  }
  function mprFor(playerId){
    let marks=0,rounds=0;
    for(const visit of visits){
      if(visit.player_id!==playerId)continue;
      rounds++;
      for(const dart of Array.isArray(visit.darts)?visit.darts:[]){
        marks+=Math.max(0,Math.min(3,Number(dart?.mult)||0));
      }
    }
    return rounds?(marks/rounds).toFixed(2):'0.00';
  }
  function renderMpr(){
    if(!m)return;
    const p1=$('cricketMpr1'),p2=$('cricketMpr2');
    if(p1)p1.textContent=mprFor(m.player1_id);
    if(p2)p2.textContent=mprFor(m.player2_id);
  }
  function canInput(){return !submitting&&(editingVisitId!==null?!!m&&m.status==='playing':canThrow())}
  function canAdd(item){if(!canInput())return false;try{pack([...selectedDarts,item]);return true}catch{return false}}
  function addMark(target){
    const item={target:normalizeTarget(target),mult:1};
    if(!canAdd(item)){if(canInput())$('matchMessage').textContent='Dette krever mer enn tre piler.';return}
    selectedDarts.push(item);$('matchMessage').textContent='';renderEntry();
  }
  function addMiss(){
    const item={target:'MISS',mult:0};
    if(!canAdd(item)){if(canInput())$('matchMessage').textContent='Dette krever mer enn tre piler.';return}
    selectedDarts.push(item);$('matchMessage').textContent='';renderEntry();
  }

  renderEntry=function(){
    const host=$('cricketDarts'),enabled=canInput();if(!host)return;
    const bits=[];
    if(editingVisitId!==null)bits.push('<span class="cricket-dart editing">KORRIGERING</span>');
    const{counts,misses}=aggregate(selectedDarts);
    for(const t of TARGETS)if(counts[t])bits.push(`<span class="cricket-dart">${t==='B'?'Bull':t} × ${counts[t]}</span>`);
    if(misses)bits.push(`<span class="cricket-dart">Miss × ${misses}</span>`);
    if(selectedDarts.length){let used=0;try{used=pack(selectedDarts).length}catch{}bits.push(`<span class="cricket-dart buffer-meta">min. ${used} ${used===1?'pil':'piler'}</span>`)}
    else bits.push('<span class="cricket-dart empty">Tast 0, 9, 8, 7, 6, 5 eller B for treff</span>');
    host.innerHTML=bits.join('');
    $('cricketMissBtn').disabled=!enabled||!canAdd({target:'MISS',mult:0});
    $('cricketUndoBtn').disabled=!enabled||!selectedDarts.length;
    $('cricketSubmitBtn').disabled=!enabled||!selectedDarts.length;
    $('cricketSubmitBtn').textContent=editingVisitId!==null?'Lagre korrigering':'Registrer kast';
    $('cricketCancelEditBtn')?.classList.toggle('hidden',editingVisitId===null);
    if($('cricketEntryTitle'))$('cricketEntryTitle').textContent=editingVisitId!==null?'KORRIGER KAST':'DITT KAST';
  };

  async function loadVisits(){
    if(!m?.id)return;
    const{data,error}=await db.from('cricket_visits').select('id,match_id,player_id,leg_no,visit_no,darts,points_scored,created_at,corrected_at').eq('match_id',m.id).order('id',{ascending:true});
    if(error){console.warn('Cricket visit log:',error.message);return}
    visits=data||[];
  }
  function latestActive(){const rows=visits.filter(v=>Number(v.leg_no)===Number(m?.current_leg));return rows.at(-1)||null}
  function renderLog(){
    renderMpr();
    const host=$('cricketVisitLog');if(!host)return;
    if(!visits.length){host.innerHTML='<div class="cricket-history-empty">Ingen kast registrert ennå.</div>';return}
    const latest=latestActive();
    host.innerHTML=[...visits].reverse().map(v=>{
      const editable=!isChicago()&&m?.status==='playing'&&latest?.id===v.id&&v.player_id===profile?.id&&Number(v.leg_no)===Number(m.current_leg);
      const text=summary(expand(v.darts)),points=Number(v.points_scored||0),name=esc(names[v.player_id]||'Spiller');
      return `<div class="cricket-history-row${v.corrected_at?' corrected':''}"><span class="cricket-history-meta">L${v.leg_no} · #${v.visit_no}</span><span class="cricket-history-player">${name}</span><span class="cricket-history-marks">${esc(text)}${v.corrected_at?' · korrigert':''}</span><span class="cricket-history-points">${points?`+${points}`:'—'}</span><span>${editable?`<button class="outline cricket-history-edit" data-edit-visit="${v.id}">Korriger</button>`:''}</span></div>`;
    }).join('');
    host.querySelectorAll('[data-edit-visit]').forEach(b=>b.onclick=()=>startCorrection(Number(b.dataset.editVisit)));
  }
  function startCorrection(id){
    const v=visits.find(x=>Number(x.id)===Number(id)),latest=latestActive();
    if(isChicago()||!v||latest?.id!==v.id||v.player_id!==profile?.id||m?.status!=='playing')return;
    editingVisitId=v.id;selectedDarts=expand(v.darts);
    $('matchMessage').textContent='Korriger siste kast med tastene. Enter lagrer, Esc avbryter.';
    renderEntry();renderLog();
  }
  function cancelCorrection(){editingVisitId=null;selectedDarts=[];$('matchMessage').textContent='Korrigering avbrutt.';renderEntry();renderLog()}

  const baseRefresh=refreshGame;
  refreshGame=async function(){await baseRefresh();await loadVisits();renderLog()};
  render=function(){baseRender();renderLog()};

  submitVisit=async function({emptyAsMisses=false}={}){
    if(!canInput())return;
    if(!selectedDarts.length&&emptyAsMisses){
      selectedDarts=[
        {target:'MISS',mult:0},
        {target:'MISS',mult:0},
        {target:'MISS',mult:0}
      ];
    }
    if(!selectedDarts.length)return;
    let darts;try{darts=pack(selectedDarts)}catch(error){$('matchMessage').textContent=error.message;return}
    submitting=true;renderEntry();$('matchMessage').textContent=editingVisitId!==null?'Lagrer korrigering…':'Registrerer…';
    try{
      let data,error;
      if(editingVisitId!==null)({data,error}=await db.rpc('correct_last_cricket_visit',{p_visit_id:editingVisitId,p_darts:darts}));
      else{const rpc=isChicago()?'submit_chicago_cricket_visit':'submit_cricket_visit';({data,error}=await db.rpc(rpc,{p_match_id:matchId,p_darts:darts}))}
      if(error)throw error;
      const wasEdit=editingVisitId!==null;editingVisitId=null;selectedDarts=[];
      await refreshGame();
      if(wasEdit)$('matchMessage').textContent=data?.leg_won?'Korrigert – leget er vunnet.':'Kastet er korrigert.';
      else $('matchMessage').textContent=data?.leg_won?(m.status==='finished'?'Kampen er vunnet!':'Leg vunnet!'):(Number(data?.points_scored||0)>0?`+${data.points_scored} poeng`:'');
      if(m.status==='finished')await setPlayersUnavailable();
    }catch(error){
      $('matchMessage').textContent=String(error?.message||'Kunne ikke registrere kastet.').replace('It is not your turn','Det er ikke din tur.').replace('Only the latest visit in the active leg can be corrected','Bare siste registrerte kast i aktivt leg kan korrigeres.');
    }finally{submitting=false;renderEntry();renderLog()}
  };

  // Replace the old mouse-oriented handlers with keyboard-first handlers.
  $('cricketMissBtn').onclick=addMiss;
  $('cricketUndoBtn').onclick=()=>{if(!canInput()||!selectedDarts.length)return;selectedDarts.pop();renderEntry()};
  $('cricketCancelEditBtn').onclick=cancelCorrection;
  $('cricketSubmitBtn').onclick=()=>submitVisit();

  document.addEventListener('keydown',e=>{
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    if(['input','textarea','select'].includes(tag)||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
    const key=e.key.toLowerCase(),target=KEY_TARGETS[key];
    if(target){e.preventDefault();addMark(target);return}
    if(e.code==='Space'){e.preventDefault();addMiss();return}
    if(e.key==='Backspace'){e.preventDefault();if(canInput()&&selectedDarts.length){selectedDarts.pop();renderEntry()}return}
    if(e.key==='Enter'){e.preventDefault();submitVisit({emptyAsMisses:true});return}
    if(e.key==='Escape'&&editingVisitId!==null){e.preventDefault();cancelCorrection()}
  });

  async function start(){
    if(ready||!m?.id||!profile?.id)return;
    ready=true;await loadVisits();renderLog();renderEntry();
    if(isChicago()){const help=document.querySelector('.cricket-history-head span');if(help)help.textContent='Chicago Style • kastlogg vises, men teller ikke i spillerstatistikk';}
    logChannel=db.channel('cricket-log-'+m.id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${m.id}`},async()=>{await loadVisits();renderLog();renderEntry()})
      .on('postgres_changes',{event:'*',schema:'public',table:'cricket_visits',filter:`match_id=eq.${m.id}`},async()=>{await loadVisits();renderLog();renderEntry()})
      .subscribe();
  }
  const wait=setInterval(()=>{if(m?.id&&profile?.id){clearInterval(wait);start()}},100);
  window.addEventListener('pagehide',()=>{try{if(logChannel)db.removeChannel(logChannel)}catch{}});
})();