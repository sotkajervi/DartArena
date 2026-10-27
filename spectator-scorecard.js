/* Spectator scorecard metrics, same read-only pockets as live-avg.js.
   This module has no database, transport or game-state writes. */
(function(root){
  'use strict';
  const doc=root.document;
  const get=id=>doc?.getElementById(id);
  const finite=n=>Number.isFinite(Number(n));
  const countDarts=row=>{
    const used=Number(row?.darts_used);
    return row?.is_checkout===true && Number.isInteger(used)&&used>=1&&used<=3?used:3;
  };
  const isCricket=m=>{
    if(!m)return false;
    const config=m.game_config||{};
    const chicago=String(config.chicago??'false').toLowerCase()==='true';
    const stage=Number(config.chicago_stage||m.current_leg||1);
    return String(m.game_variant||'').toLowerCase()==='cricket'||(chicago&&stage===2);
  };
  function metrics(m,rows,playerId,slot){
    if(!m||!playerId)return {darts:null,average:null};
    const all=Array.isArray(rows)?rows:null;
    const setNo=Number(m.current_set||1),legNo=Number(m.current_leg||1);
    const chicago=String(m.game_config?.chicago??'false').toLowerCase()==='true';
    const scoped=all?.filter(v=>String(v.player_id)===String(playerId))||[];
    const stageRows=chicago?scoped.filter(v=>Number(v.leg_no||1)===legNo):scoped;
    const legRows=scoped.filter(v=>Number(v.set_no||1)===setNo&&Number(v.leg_no||1)===legNo);
    const darts=all?legRows.reduce((sum,v)=>sum+countDarts(v),0):null;
    const points=stageRows.reduce((sum,v)=>sum+Number(v.score||0),0);
    const arrows=stageRows.reduce((sum,v)=>sum+countDarts(v),0);
    const computed=arrows?points*3/arrows:0;
    const rpcAverage=m['player'+slot+'_avg'];
    // Ordinary Spectate may get a rolling window of 150 visits; prefer its
    // authoritative all-match average, except Chicago's stage-specific AVG.
    const average=!chicago&&finite(rpcAverage)?Number(rpcAverage)
      :(all?computed:null);
    return {darts,average};
  }
  function legStarter(m){
    if(!m||!m.match_starter_id)return null;
    const p1=m.player1_id,p2=m.player2_id,other=id=>id===p1?p2:id===p2?p1:null;
    const setNo=Math.max(1,Number(m.current_set)||1);
    const legNo=Math.max(1,Number(m.current_leg)||1);
    const setStarter=setNo%2===1?m.match_starter_id:other(m.match_starter_id);
    return legNo%2===1?setStarter:other(setStarter);
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
  function updateStarter(m,mode){
    const starter=m.status==='playing'&&!isCricket(m)?legStarter(m):null;
    for(const n of [1,2]){
      const name=get(mode==='spectate'?'spectatePlayer'+n:'p'+n);
      const card=get(mode==='spectate'?'spectatePlayerCard'+n:'p'+n+'PlayerCard');
      name?.querySelector('.da-leg-starter-dart')?.remove();
      if(name&&starter&&String(starter)===String(m['player'+n+'_id'])){
        const marker=doc.createElement('span');
        marker.className='da-leg-starter-dart';
        marker.setAttribute('aria-label','Startet dette legget');
        marker.title='Startet dette legget';
        marker.innerHTML=`<svg viewBox="0 0 34 30" aria-hidden="true" focusable="false">
          ${dartSvg(7.2,1.1,-10)}${dartSvg(17,0,0)}${dartSvg(26.8,1.1,10)}</svg>`;
        name.appendChild(marker);
      }
      if(card){
        const host=mode==='spectate'?card.closest('.spectate-lane'):card;
        if(host)host.style.order=starter&&String(starter)===String(m['player'+n+'_id'])?'0':String(n+1);
      }
    }
  }
  function sync(m,rows,options={}){
    if(!m||!doc)return;
    const mode=options.mode==='spectate'?'spectate':'tournament';
    if(mode==='spectate'){
      for(const slot of [1,2]){
        const data=metrics(m,rows,m['player'+slot+'_id'],slot);
        const count=get('spectateDarts'+slot),avg=get('spectateCardAvg'+slot);
        if(count)count.textContent=data.darts===null?'–':String(data.darts);
        if(avg)avg.textContent=data.average===null?'–':data.average.toFixed(2);
        get('spectatePlayerCard'+slot)?.classList.toggle('da-spectator-non-x01',isCricket(m));
      }
    }else{
      for(const slot of [1,2]){
        const data=metrics(m,rows,m['player'+slot+'_id'],slot);
        const count=get('p'+slot+'Darts'),avg=get('p'+slot+'Avg');
        if(count)count.textContent=data.darts===null?'–':String(data.darts);
        if(avg)avg.textContent=data.average===null?'–':data.average.toFixed(2);
        get('p'+slot+'PlayerCard')?.classList.toggle('da-spectator-non-x01',isCricket(m));
      }
    }
    updateStarter(m,mode);
  }
  root.DartArenaSpectatorScorecard=Object.freeze({sync,metrics,countDarts,isCricket,legStarter});
})(window);
