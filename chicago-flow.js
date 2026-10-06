(()=>{
  if(window.__dartArenaChicagoFlow)return;
  window.__dartArenaChicagoFlow=true;

  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;

  const client=typeof db!=='undefined'
    ?db
    :window.supabase.createClient(
      'https://jqpxlbhwvskhjbqrbidk.supabase.co',
      'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
    );

  const page=()=>location.pathname.split('/').pop()||'';
  const isChicago=m=>String(m?.game_config?.chicago??'false').toLowerCase()==='true';
  const stageOf=m=>Number(m?.game_config?.chicago_stage||m?.current_leg||1);
  const stageLabel=stage=>stage===1?'301 DOUBLE IN / DOUBLE OUT':stage===2?'CRICKET':'501 DOUBLE OUT';

  function scoreText(m){
    return `${Number(m?.player1_legs||0)}–${Number(m?.player2_legs||0)}`;
  }

  function ensureBadge(){
    let badge=document.getElementById('chicagoStageBadge');
    if(badge)return badge;
    const head=document.querySelector('.match-head>div:first-child');
    if(!head)return null;
    badge=document.createElement('div');
    badge.id='chicagoStageBadge';
    badge.style.cssText='margin-top:8px;display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border:1px solid rgba(35,226,209,.35);border-radius:999px;background:rgba(35,226,209,.07);font-size:11px;font-weight:900;letter-spacing:.055em;color:var(--cyan)';
    head.appendChild(badge);
    return badge;
  }

  function draw(m){
    if(!isChicago(m))return;
    const stage=stageOf(m),badge=ensureBadge();
    if(badge)badge.textContent=`CHICAGO STYLE • GAME ${Math.min(stage,3)} AV 3 • ${stageLabel(stage)} • ${scoreText(m)}`;

    const format=document.getElementById('matchFormat');
    if(format)format.textContent=`CHICAGO STYLE • GAME ${Math.min(stage,3)}/3 • ${stageLabel(stage)}`;

    const p1=document.getElementById('matchLegs1')||document.getElementById('cricketLegs1');
    const p2=document.getElementById('matchLegs2')||document.getElementById('cricketLegs2');
    if(p1)p1.textContent=`${Number(m.player1_legs||0)} game${Number(m.player1_legs||0)===1?'':'s'}`;
    if(p2)p2.textContent=`${Number(m.player2_legs||0)} game${Number(m.player2_legs||0)===1?'':'s'}`;

    if(stage===1){
      const msg=document.getElementById('matchMessage');
      if(msg&&!msg.textContent)msg.textContent='301 spilles Double In / Double Out. Før åpning teller bare score fra og med første double.';
    }
  }

  function route(m){
    if(!isChicago(m)||m.status!=='playing')return false;
    const here=page();
    if(m.game_variant==='cricket'&&here!=='cricket.html'){
      location.replace(`cricket.html?id=${encodeURIComponent(matchId)}`);
      return true;
    }
    if(m.game_variant==='x01'&&here==='cricket.html'){
      location.replace(`match.html?id=${encodeURIComponent(matchId)}`);
      return true;
    }
    return false;
  }

  async function boot(){
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const {data,error}=await client.from('matches').select('*').eq('id',matchId).single();
    if(error||!data||!isChicago(data))return;
    if(route(data))return;
    draw(data);

    const channel=client.channel('chicago-flow-'+matchId)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},payload=>{
        const next=payload.new;
        if(!isChicago(next))return;
        if(route(next))return;
        draw(next);
      })
      .subscribe();

    window.addEventListener('pagehide',()=>client.removeChannel(channel),{once:true});
  }

  boot().catch(error=>console.warn('Chicago flow failed',error));
})();