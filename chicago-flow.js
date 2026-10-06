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
  const stageLabel=stage=>stage===1?'301 DIDO':stage===2?'CRICKET':'501 SIDO';

  function scoreText(m){
    return `${Number(m?.player1_legs||0)}–${Number(m?.player2_legs||0)}`;
  }

  function ensureBadge(){
    let badge=document.getElementById('chicagoStageBadge');
    if(badge)return badge;
    const head=document.querySelector('.match-head');
    if(!head)return null;

    if(!document.getElementById('chicagoStageBadgeStyle')){
      const style=document.createElement('style');
      style.id='chicagoStageBadgeStyle';
      style.textContent=`
        .match-page #chicagoStageBadge{
          flex:1 1 auto;
          min-width:0;
          max-width:820px;
          margin:0 22px;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          flex-wrap:wrap;
          padding:13px 22px;
          border:2px solid rgba(35,226,209,.42);
          border-radius:18px;
          background:rgba(35,226,209,.08);
          font-size:clamp(16px,1.25vw,20px);
          line-height:1.15;
          font-weight:950;
          letter-spacing:.035em;
          color:var(--cyan);
          text-align:center;
          white-space:nowrap;
        }
        @media(max-width:800px){
          .match-page #chicagoStageBadge{
            width:100%;
            max-width:none;
            margin:2px 0 0;
            padding:11px 14px;
            font-size:14px;
            white-space:normal;
          }
        }
      `;
      document.head.appendChild(style);
    }

    badge=document.createElement('div');
    badge.id='chicagoStageBadge';
    const actions=head.querySelector('.top-actions');
    if(actions)head.insertBefore(badge,actions);
    else head.appendChild(badge);
    return badge;
  }

  function draw(m){
    if(!isChicago(m))return;
    const stage=stageOf(m),badge=ensureBadge();
    if(badge)badge.textContent=`CHICAGO STYLE • GAME ${Math.min(stage,3)} AV 3 • ${stageLabel(stage)} • ${scoreText(m)}`;

    const format=document.getElementById('matchFormat');
    if(format)format.textContent=stageLabel(stage);

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