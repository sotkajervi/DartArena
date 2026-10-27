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
  }
  root.DartArenaSpectatorScorecard=Object.freeze({sync,metrics,countDarts,isCricket});
})(window);
