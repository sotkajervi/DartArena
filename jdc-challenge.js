(()=>{
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TIER_LABELS={white:'White',purple:'Purple',yellow:'Yellow',green:'Green',blue:'Blue',red:'Red',black:'Black',gold:'Gold'};
  let session=null;
  let hits=[];
  let submitted=false;

  function badgeFor(score){
    if(score>=1250)return'gold';
    if(score>=850)return'black';
    if(score>=700)return'red';
    if(score>=600)return'blue';
    if(score>=450)return'green';
    if(score>=300)return'yellow';
    if(score>=150)return'purple';
    return'white';
  }

  function scoreShanghai(startIndex,firstTarget){
    let score=0,bonuses=0;
    for(let targetOffset=0;targetOffset<6;targetOffset++){
      const target=firstTarget+targetOffset;
      const group=hits.slice(startIndex+targetOffset*3,startIndex+targetOffset*3+3);
      let s=false,d=false,t=false;
      for(const code of group){
        if(code==='S'){score+=target;s=true}
        else if(code==='D'){score+=target*2;d=true}
        else if(code==='T'){score+=target*3;t=true}
      }
      if(group.length===3&&s&&d&&t){score+=100;bonuses++}
    }
    return{score,bonuses};
  }

  function calculate(){
    const p1=scoreShanghai(0,10);
    let doubles=0,doublesHit=0;
    for(let i=18;i<39&&i<hits.length;i++){
      if(hits[i]!=='H')continue;
      doublesHit++;
      doubles+=i===38?100:50;
    }
    const p3=scoreShanghai(39,15);
    const score=p1.score+doubles+p3.score;
    return{score,phase1:p1.score,doubles,phase3:p3.score,doublesHit,shanghai:p1.bonuses+p3.bonuses,badge:badgeFor(score)};
  }

  function position(){
    const i=hits.length;
    if(i<18)return{phase:1,phaseName:'SHANGHAI 10–15',target:String(10+Math.floor(i/3)),dart:(i%3)+1,maxDarts:3,kind:'shanghai'};
    if(i<39){
      const n=i-18;
      return{phase:2,phaseName:'DOUBLES',target:n===20?'BULL':`D${n+1}`,dart:1,maxDarts:1,kind:'double'};
    }
    if(i<57)return{phase:3,phaseName:'SHANGHAI 15–20',target:String(15+Math.floor((i-39)/3)),dart:((i-39)%3)+1,maxDarts:3,kind:'shanghai'};
    return{phase:3,phaseName:'FERDIG',target:'✓',dart:3,maxDarts:3,kind:'done'};
  }

  function render(){
    const pos=position(),stats=calculate();
    $('phaseTitle').textContent=`FASE ${pos.phase} • ${pos.phaseName}`;
    $('targetValue').textContent=pos.target;
    $('dartMeta').textContent=pos.kind==='done'?'57 / 57 piler':`Pil ${pos.dart} av ${pos.maxDarts} • ${hits.length} / 57 totalt`;
    $('totalScore').textContent=stats.score;
    $('phase1Score').textContent=stats.phase1;
    $('doublesScore').textContent=stats.doubles;
    $('phase3Score').textContent=stats.phase3;
    $('shanghaiCount').textContent=stats.shanghai;
    if($('doublesHit'))$('doublesHit').textContent=stats.doublesHit;
    $('tierName').textContent=TIER_LABELS[stats.badge];
    $('tierDot').dataset.jdcTier=stats.badge;
    $('tierDot').title=`JDC Challenge: ${TIER_LABELS[stats.badge]} • ${stats.score} poeng`;
    $('shanghaiActions').classList.toggle('hidden',pos.kind!=='shanghai');
    $('doubleActions').classList.toggle('hidden',pos.kind!=='double');
    $('undoBtn').disabled=!hits.length||submitted;
    if(pos.kind==='done'&&!submitted)finish();
  }

  function addHit(code){
    if(hits.length>=57||submitted)return;
    hits.push(code);
    render();
  }

  async function finish(){
    submitted=true;
    $('gameMessage').textContent='Lagrer resultat…';
    const local=calculate();
    const{data,error}=await db.rpc('submit_jdc_challenge',{p_hits:hits});
    if(error){
      console.error('JDC submit failed',error);
      submitted=false;
      $('undoBtn').disabled=false;
      $('gameMessage').textContent='Kunne ikke lagre resultatet. Angre siste pil og registrer den på nytt for å prøve igjen.';
      return;
    }
    const result=(Array.isArray(data)?data[0]:data)||local;
    $('gameMessage').textContent=`Lagret • ${TIER_LABELS[result.badge]||TIER_LABELS[local.badge]}`;
    await loadLeaderboard();
    if(window.DartArenaResults?.showSolo){
      window.DartArenaResults.showSolo({
        title:'JDC Challenge',
        subtitle:'57 piler • 3 faser',
        score:Number(result.score??local.score),
        playerName:`${TIER_LABELS[result.badge||local.badge]} tier`,
        stats:[
          {label:'SHANGHAI 1',value:Number(result.phase1_score??local.phase1)},
          {label:'DOUBLES TREFF',value:Number(result.doubles_hit??local.doublesHit)},
          {label:'SHANGHAI 2',value:Number(result.phase3_score??local.phase3)},
          {label:'BONUSER',value:Number(result.shanghai_count??local.shanghai)}
        ],
        actions:[
          {label:'Ny challenge',primary:true,onClick:reset},
          {label:'Til lobby',onClick:()=>location.href='./'}
        ]
      });
    }
  }

  function reset(){
    window.DartArenaResults?.hide?.();
    hits=[];
    submitted=false;
    $('gameMessage').textContent='';
    render();
  }

  function tierDot(badge,score){
    const label=TIER_LABELS[badge]||badge||'White';
    return`<span class="jdc-tier-dot" data-jdc-tier="${esc(badge||'white')}" title="JDC Challenge: ${esc(label)} • beste ${Number(score)||0}"></span>`;
  }

  async function loadLeaderboard(){
    const host=$('leaderboardRows');
    host.innerHTML='<div class="jdc-empty">Laster…</div>';
    const{data,error}=await db.from('jdc_challenge_best').select('user_id,username,best_score,badge,achieved_at').order('best_score',{ascending:false}).order('achieved_at',{ascending:true}).limit(10);
    if(error){host.innerHTML='<div class="jdc-empty">Kunne ikke laste topplisten.</div>';return}
    if(!data?.length){host.innerHTML='<div class="jdc-empty">Ingen registrerte resultater ennå.</div>';renderMyBest(null);return}
    host.innerHTML=data.map((row,index)=>`<div class="jdc-lb-row"><b>${index+1}</b><strong>${esc(row.username||'Spiller')}${tierDot(row.badge,row.best_score)}</strong><span class="score">${Number(row.best_score)||0}</span><span class="tier">${esc(TIER_LABELS[row.badge]||row.badge||'')}</span></div>`).join('');
    const mine=data.find(row=>row.user_id===session?.user?.id);
    if(mine)renderMyBest(mine);
    else{
      const{data:own}=await db.from('jdc_challenge_best').select('best_score,badge').eq('user_id',session.user.id).maybeSingle();
      renderMyBest(own);
    }
  }

  function renderMyBest(row){
    const host=$('myBest');
    if(!row){host.textContent='Din beste: ingen registrert score ennå.';return}
    host.innerHTML=`Din beste: <strong>${Number(row.best_score)||0}</strong>${tierDot(row.badge,row.best_score)}<span class="jdc-tier-label">${esc(TIER_LABELS[row.badge]||row.badge)}</span>`;
  }

  async function boot(){
    const{data:{session:s}}=await db.auth.getSession();
    session=s;
    if(!session)return location.replace('./');
    $('backBtn').onclick=()=>location.href='./';
    $('missBtn').onclick=()=>addHit('M');
    $('singleBtn').onclick=()=>addHit('S');
    $('doubleBtn').onclick=()=>addHit('D');
    $('tripleBtn').onclick=()=>addHit('T');
    $('doubleMissBtn').onclick=()=>addHit('M');
    $('doubleHitBtn').onclick=()=>addHit('H');
    $('undoBtn').onclick=()=>{if(hits.length&&!submitted){hits.pop();render()}};
    $('restartBtn').onclick=reset;
    render();
    await loadLeaderboard();
  }

  boot().catch(error=>{
    console.error('JDC Challenge failed',error);
    $('gameMessage').textContent='JDC Challenge kunne ikke startes.';
  });
})();
