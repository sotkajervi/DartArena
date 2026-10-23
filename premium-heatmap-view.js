/* Read-only heatmaps for the full X01 statistics page.
   Heatmap points are session-scoped camera estimates from the completed match.
   This module never modifies scores or the original photographed dartboard. */
(()=>{
  'use strict';
  if(document.body.dataset.statsSource!=='match')return;
  const Chart=window.DartArenaHeatmapChart;
  const matchId=new URLSearchParams(location.search).get('id');
  if(!Chart||!matchId)return;
  const view=document.getElementById('statsView');
  if(!view)return;
  const cacheKey='dartarena-x01-heatmap-result-v1:'+matchId;
  let playerIds=[],cards=[],lastSnapshot='',refreshTimer=null;

  const style=document.createElement('style');
  style.textContent=`
    .premium-hm-section{margin-top:16px;padding:14px;border:1px solid rgba(0,234,244,.23);border-radius:14px;background:rgba(4,17,20,.64)}
    .premium-hm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px;color:#e1f5f6;font-size:13px;font-weight:950;letter-spacing:.09em}
    .premium-hm-head span{color:#00eaf4;font-size:10px}
    .premium-hm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .premium-hm-player{min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px;border:1px solid rgba(255,255,255,.085);border-radius:12px;background:rgba(0,0,0,.14)}
    .premium-hm-player strong{max-width:100%;font-size:13px;text-align:center;overflow-wrap:anywhere}
    .premium-hm-player canvas{display:block;width:min(100%,300px);height:auto;aspect-ratio:1;border-radius:9px;background:#071012}
    .premium-hm-player small{font-size:11px;line-height:1.3;text-align:center;color:#bed1d3}
    .premium-hm-note{margin:10px 0 0;font-size:10px;line-height:1.4;text-align:center;color:#9ab4b8}
    @media(max-width:530px){.premium-hm-section{padding:9px}.premium-hm-grid{gap:7px}.premium-hm-player{padding:6px;gap:5px}.premium-hm-player strong{font-size:11px}.premium-hm-player small{font-size:9px}}
  `;
  document.head.appendChild(style);

  function rowsForMatch(){
    const stores=[];
    // A separately opened same-origin statistics tab can read the live match's
    // session cache without exposing it as permanent account-wide storage.
    try{
      if(window.opener&&window.opener!==window&&window.opener.location.origin===location.origin){
        stores.push(window.opener.sessionStorage);
      }
    }catch{}
    try{stores.push(window.sessionStorage)}catch{}
    const result={};
    for(const store of stores){
      let obj;
      try{obj=JSON.parse(store.getItem(cacheKey)||'{}')}catch{continue}
      if(!obj||typeof obj!=='object')continue;
      for(const id of playerIds){
        const rows=Array.isArray(obj[id])?obj[id]:[];
        const valid=rows.slice(-600).filter(p=>Number.isFinite(p?.u)&&Number.isFinite(p?.v)&&Math.hypot(p.u,p.v)<=1.55);
        if(valid.length>(result[id]?.length||0))result[id]=valid;
      }
    }
    return result;
  }

  function updateHeatmaps(){
    if(!cards.length)return;
    const data=rowsForMatch();
    const signature=JSON.stringify(playerIds.map(id=>data[id]||[]));
    if(signature===lastSnapshot)return;
    lastSnapshot=signature;
    for(const entry of cards){
      const points=data[entry.id]||[];
      Chart.draw(entry.canvas,points);
      entry.caption.textContent=points.length
        ?points.length+' registrert'+(points.length===1?'':'e')+' treff'
        :'Ingen heatmap-data tilgjengelig fra denne økten.';
    }
  }

  function mount(){
    if(cards.length)return;
    // Only the completed X01 view has exactly these two player cards.
    const players=[...view.querySelectorAll('.premium-player-grid .premium-player-card[data-player-id]')];
    const grid=view.querySelector('.premium-player-grid');
    if(!grid||players.length!==2)return;
    const resultCard=view.querySelector('.premium-result-card');
    if(!resultCard)return;
    playerIds=players.map(player=>player.dataset.playerId);
    const section=document.createElement('section');
    section.className='premium-hm-section';
    const heading=document.createElement('div');
    heading.className='premium-hm-head';
    heading.innerHTML='HEATMAP <span>BETA</span>';
    const maps=document.createElement('div');
    maps.className='premium-hm-grid';
    for(const player of players){
      const id=player.dataset.playerId;
      const name=player.querySelector('.premium-player-name')?.textContent||'Spiller';
      const card=document.createElement('article');
      card.className='premium-hm-player';
      const title=document.createElement('strong');title.textContent=name;
      const canvas=document.createElement('canvas');
      canvas.width=340;canvas.height=340;
      canvas.setAttribute('aria-label','Heatmap for '+name);
      const caption=document.createElement('small');
      card.append(title,canvas,caption);
      maps.appendChild(card);
      cards.push({id,canvas,caption});
    }
    const note=document.createElement('p');
    note.className='premium-hm-note';
    note.textContent='Kameraestimater, ikke poengfasit. Heatmap-data er foreløpig tilgjengelig bare fra den aktive kampøkten.';
    section.append(heading,maps,note);
    grid.insertAdjacentElement('afterend',section);
    observer.disconnect();
    updateHeatmaps();
    // The other player's points may arrive shortly after the match ends.
    let ticks=0;
    refreshTimer=setInterval(()=>{
      updateHeatmaps();
      if(++ticks>=24){clearInterval(refreshTimer);refreshTimer=null}
    },2500);
    window.addEventListener('focus',updateHeatmaps);
  }

  const observer=new MutationObserver(mount);
  observer.observe(view,{childList:true,subtree:true});
  mount();
  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    if(refreshTimer)clearInterval(refreshTimer);
    window.removeEventListener('focus',updateHeatmaps);
  },{once:true});
})();