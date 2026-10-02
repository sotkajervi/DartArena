(()=>{
  if(window.__dartArenaLegStarterMarker)return;
  window.__dartArenaLegStarterMarker=true;

  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const style=document.createElement('style');
  style.textContent=`
    .match-name{display:inline-flex;align-items:center;gap:8px;max-width:100%}
    .da-leg-starter-dart{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      flex:0 0 auto;
      width:24px;
      height:24px;
      color:var(--cyan,#23e2d1);
      filter:drop-shadow(0 0 5px rgba(35,226,209,.55));
      opacity:.96;
      vertical-align:middle;
    }
    .da-leg-starter-dart svg{display:block;width:24px;height:24px;overflow:visible}
    .da-leg-starter-dart .dart-shaft{stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
    .da-leg-starter-dart .dart-tip{fill:currentColor}
    .da-leg-starter-dart .dart-flight{fill:rgba(35,226,209,.18);stroke:currentColor;stroke-width:1.1;stroke-linejoin:round}
    @media(max-width:600px){
      .match-name{gap:6px}
      .da-leg-starter-dart,.da-leg-starter-dart svg{width:21px;height:21px}
    }
  `;
  document.head.appendChild(style);

  let match=null;
  let channel=null;
  let retryTimers=[];

  function otherPlayer(id){
    if(id===match?.player1_id)return match.player2_id;
    if(id===match?.player2_id)return match.player1_id;
    return null;
  }

  function legStarter(){
    if(!match)return null;
    const base=match.match_starter_id;
    if(!base)return null;
    const setNo=Math.max(1,Number(match.current_set)||1);
    const legNo=Math.max(1,Number(match.current_leg)||1);
    const setStarter=setNo%2===1?base:otherPlayer(base);
    return legNo%2===1?setStarter:otherPlayer(setStarter);
  }

  function marker(){
    const el=document.createElement('span');
    el.className='da-leg-starter-dart';
    el.title='Startet dette legget';
    el.setAttribute('aria-label','Startet dette legget');
    el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g transform="translate(1.5 0)">
        <path class="dart-flight" d="M2.2 2.5 5.5 4.2 3.9 7.2 2.2 5.8.5 7.2-1.1 4.2Z"/>
        <path class="dart-shaft" d="M2.2 6.4v10.1"/>
        <path class="dart-tip" d="m.7 16.2 1.5 5.3 1.5-5.3-1.5.8Z"/>
      </g>
      <g transform="translate(9.8 -1.2)">
        <path class="dart-flight" d="M2.2 2.5 5.5 4.2 3.9 7.2 2.2 5.8.5 7.2-1.1 4.2Z"/>
        <path class="dart-shaft" d="M2.2 6.4v10.1"/>
        <path class="dart-tip" d="m.7 16.2 1.5 5.3 1.5-5.3-1.5.8Z"/>
      </g>
      <g transform="translate(18.1 0)">
        <path class="dart-flight" d="M2.2 2.5 5.5 4.2 3.9 7.2 2.2 5.8.5 7.2-1.1 4.2Z"/>
        <path class="dart-shaft" d="M2.2 6.4v10.1"/>
        <path class="dart-tip" d="m.7 16.2 1.5 5.3 1.5-5.3-1.5.8Z"/>
      </g>
    </svg>`;
    return el;
  }

  function render(){
    const name1=document.getElementById('matchName1');
    const name2=document.getElementById('matchName2');
    if(!name1||!name2||!match)return false;

    name1.querySelector('.da-leg-starter-dart')?.remove();
    name2.querySelector('.da-leg-starter-dart')?.remove();

    if(match.status!=='playing')return true;
    const starter=legStarter();
    if(!starter)return true;

    const host=starter===match.player1_id?name1:starter===match.player2_id?name2:null;
    if(host)host.appendChild(marker());
    return true;
  }

  function scheduleStableRender(){
    retryTimers.forEach(clearTimeout);
    retryTimers=[];
    [0,150,500,1200].forEach(delay=>retryTimers.push(setTimeout(render,delay)));
  }

  async function boot(){
    const {data,error}=await db.from('matches')
      .select('id,player1_id,player2_id,status,match_starter_id,current_set,current_leg,turn_player_id')
      .eq('id',matchId)
      .maybeSingle();
    if(error||!data)return;
    match=data;
    scheduleStableRender();

    channel=db.channel(`x01-leg-starter-${matchId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},payload=>{
        match={...match,...payload.new};
        scheduleStableRender();
      })
      .subscribe();
  }

  window.addEventListener('pagehide',()=>{
    retryTimers.forEach(clearTimeout);
    retryTimers=[];
    if(channel)db.removeChannel(channel);
  });

  boot().catch(error=>console.warn('Leg starter marker failed',error));
})();
