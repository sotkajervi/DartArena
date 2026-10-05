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
      width:34px;
      height:30px;
      color:var(--cyan,#23e2d1);
      filter:drop-shadow(0 0 5px rgba(35,226,209,.6));
      opacity:.98;
      vertical-align:middle;
    }
    .da-leg-starter-dart svg{display:block;width:34px;height:30px;overflow:visible}
    .da-leg-starter-dart .dart-flight{fill:rgba(35,226,209,.18);stroke:currentColor;stroke-width:1.05;stroke-linejoin:round}
    .da-leg-starter-dart .dart-shaft{stroke:currentColor;stroke-width:1.6;stroke-linecap:round}
    .da-leg-starter-dart .dart-barrel{fill:rgba(35,226,209,.35);stroke:currentColor;stroke-width:1}
    .da-leg-starter-dart .dart-grip{stroke:currentColor;stroke-width:.75;opacity:.8}
    .da-leg-starter-dart .dart-point{stroke:currentColor;stroke-width:1.15;stroke-linecap:round}
    @media(max-width:600px){
      .match-name{gap:6px}
      .da-leg-starter-dart,.da-leg-starter-dart svg{width:30px;height:27px}
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

  function dartSvg(x,y,angle){
    return `<g transform="translate(${x} ${y}) rotate(${angle} 0 13)">
      <path class="dart-flight" d="M0 0 -4.2 2.2 -2.7 6.2 0 4.6 2.7 6.2 4.2 2.2Z"/>
      <path class="dart-shaft" d="M0 4.5V12"/>
      <path class="dart-barrel" d="M-1.8 11.5H1.8L2.3 18.4 1.25 21H-1.25L-2.3 18.4Z"/>
      <path class="dart-grip" d="M-1.65 14.2H1.65M-1.8 16.2H1.8M-1.65 18.2H1.65"/>
      <path class="dart-point" d="M0 21V28"/>
    </g>`;
  }

  function marker(){
    const el=document.createElement('span');
    el.className='da-leg-starter-dart';
    el.title='Startet dette legget';
    el.setAttribute('aria-label','Startet dette legget');
    el.innerHTML=`<svg viewBox="0 0 34 30" aria-hidden="true" focusable="false">
      ${dartSvg(7.2,1.1,-10)}
      ${dartSvg(17,0,0)}
      ${dartSvg(26.8,1.1,10)}
    </svg>`;
    return el;
  }

  function orderMatchStarterFirst(){
    const p1=document.getElementById('matchP1');
    const p2=document.getElementById('matchP2');
    const wrap=p1?.parentElement;
    if(!p1||!p2||!wrap||wrap!==p2.parentElement||!match?.match_starter_id)return;
    const first=match.match_starter_id===match.player1_id?p1:match.match_starter_id===match.player2_id?p2:null;
    const second=first===p1?p2:first===p2?p1:null;
    if(first&&second&&wrap.firstElementChild!==first)wrap.insertBefore(first,second);
  }

  function render(){
    const name1=document.getElementById('matchName1');
    const name2=document.getElementById('matchName2');
    if(!name1||!name2||!match)return false;

    orderMatchStarterFirst();
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
