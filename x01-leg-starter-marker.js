(()=>{
  if(window.__dartArenaLegStarterMarker)return;

  window.__dartArenaLegStarterMarker=true;
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
      color:var(--cyan,#00eaf4);
      filter:drop-shadow(0 0 5px rgba(0,234,244,.6));
      opacity:.98;
      vertical-align:middle;
    }
    .da-leg-starter-dart svg{display:block;width:34px;height:30px;overflow:visible}
    .da-leg-starter-dart .dart-flight{fill:rgba(0,234,244,.18);stroke:currentColor;stroke-width:1.05;stroke-linejoin:round}
    .da-leg-starter-dart .dart-shaft{stroke:currentColor;stroke-width:1.6;stroke-linecap:round}
    .da-leg-starter-dart .dart-barrel{fill:rgba(0,234,244,.35);stroke:currentColor;stroke-width:1}
    .da-leg-starter-dart .dart-grip{stroke:currentColor;stroke-width:.75;opacity:.8}
    .da-leg-starter-dart .dart-point{stroke:currentColor;stroke-width:1.15;stroke-linecap:round}
    @media(max-width:600px){
      .match-name{gap:6px}
      .da-leg-starter-dart,.da-leg-starter-dart svg{width:30px;height:27px}
    }
  `;
  document.head.appendChild(style);

  let match=null;

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

  // Public presentation shared by every online mode. Only the X01 match
  // binding and alternating-leg logic below are X01-specific.
  window.DartArenaLegStarterMarkerUI=Object.freeze({create:marker});
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

    const starter=match.status==='playing'?legStarter():null;
    const host=starter===match.player1_id?name1:starter===match.player2_id?name2:null;
    for(const name of [name1,name2]){
      const existing=name.querySelector('.da-leg-starter-dart');
      if(name!==host)existing?.remove();
      else if(!existing)name.appendChild(marker());
    }
    return true;
  }

  // The room already loads the shared marker before the live match exists.
  // Bind to the authoritative scoring state at each render, not the room ID.
  // This also avoids an extra database request and Realtime channel.
  function sync(){
    const engine=window.DartArenaMatchEngineState;
    const next=engine?.match?.();
    if(!next||next.id!==engine.matchId?.()||
      !['x01','chicago'].includes(next.game_variant||'x01'))return;
    match=next;
    render();
  }

  window.addEventListener('dartarena:score-state',sync);
  window.addEventListener('pagehide',()=>window.removeEventListener('dartarena:score-state',sync),{once:true});
  sync();
})();
