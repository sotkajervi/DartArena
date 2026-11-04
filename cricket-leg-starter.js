/* Cricket starter: match_starter_id is updated to the next starter on each
   Cricket leg transition by submit_cricket_visit. Unlike X01 do not
   alternate from the initial starter again. */
(()=>{
  'use strict';
  if(window.DartArenaCricketStarter)return;
  function dart(x,y,angle){
    return `<g transform="translate(${x} ${y}) rotate(${angle} 0 13)">
      <path class="dart-flight" d="M0 0 -4.2 2.2 -2.7 6.2 0 4.6 2.7 6.2 4.2 2.2Z"/>
      <path class="dart-shaft" d="M0 4.5V12"/>
      <path class="dart-barrel" d="M-1.8 11.5H1.8L2.3 18.4 1.25 21H-1.25L-2.3 18.4Z"/>
      <path class="dart-grip" d="M-1.65 14.2H1.65M-1.8 16.2H1.8M-1.65 18.2H1.65"/>
      <path class="dart-point" d="M0 21V28"/>
    </g>`;
  }
  function render(match){
    if(!match)return;
    const players=[
      {card:document.getElementById('cricketP1'),name:document.getElementById('cricketName1'),id:match.player1_id},
      {card:document.getElementById('cricketP2'),name:document.getElementById('cricketName2'),id:match.player2_id}
    ];
    for(const player of players){
      if(!player.card||!player.name)continue;
      const name=player.name.textContent;
      player.name.textContent='';
      const text=document.createElement('span');text.className='da-cricket-name-text';text.textContent=name;
      player.name.appendChild(text);
      if(match.status!=='playing'||match.match_starter_id!==player.id)continue;
      const mark=document.createElement('span');
      mark.className='da-leg-starter-dart';
      mark.title='Startet dette legget';
      mark.setAttribute('aria-label','Startet dette legget');
      mark.innerHTML=`<svg viewBox="0 0 34 30" aria-hidden="true" focusable="false">
        ${dart(7.2,1.1,-10)}${dart(17,0,0)}${dart(26.8,1.1,10)}
      </svg>`;
      player.name.appendChild(mark);
    }
  }
  window.DartArenaCricketStarter={render};
  // Seamless Cricket loads this after the scoring engine's first render.
  render(window.DartArenaMatchEngineState?.match?.());
})();