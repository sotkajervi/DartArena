/* Tournament spectator FX, strictly read-only.
 * Uses the same FX Live engine as the match room, but only committed X01
 * match_throws paired with an authoritative match update can start a roll.
 * Cricket gets the same cinematic turn transition without numeric countdown.
 */
(function(root){
  'use strict';
  const FX=root.DartArenaFXLive;
  if(!FX)return;
  const effects={...FX.DEFAULT_EFFECTS,neon_relay:false};
  const state={id:null,stage:null,last:null,instance:null,baseline:false,
    known:new Set(),consumed:new Set(),transitions:[],queued:new Map(),reconcileTimer:null};
  const validScore=n=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=1001;
  const scores=m=>({p1:Number(m?.player1_score),p2:Number(m?.player2_score)});
  const slot=(m,id)=>id===m?.player1_id?'p1':id===m?.player2_id?'p2':null;
  const chicago=m=>String(m?.game_config?.chicago??'false').toLowerCase()==='true';
  const stageOf=m=>Number(m?.game_config?.chicago_stage||m?.current_leg||1);
  function stageKey(m){
    if(!m)return null;
    if(chicago(m)){
      const stage=stageOf(m);
      return stage===2?'cricket:2':stage===1?'x01:301:1':stage===3?'x01:501:3':null;
    }
    if(String(m.game_variant||'').toLowerCase()==='cricket')return 'cricket';
    const start=Number(m.game);
    return [170,301,501,1001].includes(start)?'x01:'+start:null;
  }
  function startScore(key){
    if(!key||!key.startsWith('x01:'))return null;
    return Number(key.split(':')[1]);
  }
  function clearTimer(){
    if(state.reconcileTimer){root.clearTimeout(state.reconcileTimer);state.reconcileTimer=null}
  }
  function clearFx(){
    clearTimer();
    state.instance?.destroy();
    state.instance=null;
    state.transitions.length=0;state.queued.clear();
  }
  function initialize(m,key){
    clearFx();
    state.id=String(m.id);state.stage=key;state.last=m;state.baseline=false;state.known.clear();state.consumed.clear();
    if(!key)return;
    try{
      if(key.startsWith('x01:')){
        const tournament=!!root.document?.getElementById('p1PlayerCard');
        state.instance=FX.createX01({
          matchId:String(m.id),level:'cinematic',effects,startScore:startScore(key),
          initialScores:scores(m),
          slots:{
            p1:tournament
              ?{score:'#s1',card:'#p1PlayerCard',camera:'#p1VideoCard'}
              :{score:'#spectateResult1',card:'#spectatePlayerCard1',camera:'#spectateVideoCard1'},
            p2:tournament
              ?{score:'#s2',card:'#p2PlayerCard',camera:'#p2VideoCard'}
              :{score:'#spectateResult2',card:'#spectatePlayerCard2',camera:'#spectateVideoCard2'}
          }
        });
      }else if(key.startsWith('cricket')){
        state.instance=FX.engine(String(m.id),{
          level:'cinematic',effects,targets:{
            'card:p1':root.document?.getElementById('p1PlayerCard')?'#p1PlayerCard':'#spectatePlayerCard1',
            'card:p2':root.document?.getElementById('p2PlayerCard')?'#p2PlayerCard':'#spectatePlayerCard2'
          }
        });
      }
    }catch(error){console.warn('Spectator FX setup unavailable',error);state.instance=null}
  }
  function sameLeg(a,b){
    return a&&b&&String(a.id)===String(b.id)&&
      Number(a.current_leg||1)===Number(b.current_leg||1)&&
      Number(a.current_set||1)===Number(b.current_set||1)&&
      stageKey(a)===stageKey(b);
  }
  function parse(before,after,visit){
    if(!before||!after||!visit||!sameLeg(before,after))return null;
    if(before.status!=='playing'||!['playing','finished'].includes(after.status))return null;
    if(String(visit.match_id)!==String(before.id)||String(visit.player_id)!==String(before.turn_player_id))return null;
    if(Number(visit.leg_no||1)!==Number(before.current_leg||1)||
       Number(visit.set_no||1)!==Number(before.current_set||1))return null;
    const playerSlot=slot(before,visit.player_id);if(!playerSlot)return null;
    const b=scores(before),a=scores(after);
    if(!Object.values(b).every(validScore)||!Object.values(a).every(validScore))return null;
    const other=playerSlot==='p1'?'p2':'p1';
    const scored=Number(visit.score),previousScore=b[playerSlot],newScore=a[playerSlot];
    const bust=previousScore===newScore&&scored>0;
    if(!Number.isInteger(scored)||scored<0||scored>180||a[other]!==b[other])return null;
    if(previousScore!==newScore&&previousScore-newScore!==scored)return null;
    if(after.status==='playing'&&before.turn_player_id===after.turn_player_id)return null;
    if(after.status==='finished'&&(visit.is_checkout!==true||after.winner_id!==visit.player_id))return null;
    if(bust&&previousScore-scored>=2&&!chicago(before))return null;
    if(previousScore===newScore&&scored!==0&&!bust)return null;
    return {confirmed:true,eventId:'spectator:'+before.id+':'+visit.id,
      playerSlot,previousScore,newScore,scored,bust,
      checkout:visit.is_checkout===true,previousTurnSlot:slot(before,before.turn_player_id),
      nextTurnSlot:slot(after,after.turn_player_id),legEnded:false,
      matchEnded:after.status==='finished'};
  }
  function reconcile(){
    if(!state.instance||!state.stage?.startsWith('x01:'))return;
    for(let j=0;j<state.transitions.length;j++){
      const item=state.transitions[j];
      if(Date.now()-item.at>4500)continue;
      for(const visit of item.visits||[]){
        if(state.consumed.has(String(visit?.id)))continue;
        const confirmed=parse(item.before,item.after,visit);
        if(!confirmed)continue;
        state.consumed.add(String(visit.id));state.queued.delete(String(visit.id));
        state.instance.syncSnapshot(scores(item.before));
        state.instance.acceptConfirmedOnlineVisit(confirmed);
        // Let LED rail/score rolls animate. The snapshot safety reconciliation
        // already scheduled by snapshot() restores the final state later.
        state.transitions.splice(j,1);j--;
        break;
      }
    }
  }
  function visitEvent(row){
    if(!row?.id||!state.id||String(row.match_id)!==state.id||!state.baseline)return;
    const key=String(row.id);if(state.known.has(key))return;
    state.known.add(key);
    if(state.known.size>900)state.known=new Set([...state.known].slice(-450));
    // INSERT and match UPDATE may arrive in either order. Retain only recent
    // committed events until a matching authoritative transition arrives.
    state.queued.set(key,{row,at:Date.now()});
    if(state.queued.size>30)state.queued.delete(state.queued.keys().next().value);
    for(const transition of state.transitions)transition.visits.push(row);
    reconcile();
  }
  function visits(rows){
    if(!state.id)return;
    const available=(Array.isArray(rows)?rows:[]).filter(r=>String(r.match_id)===state.id);
    if(!state.baseline){
      // A viewer joining mid-match should never replay existing throws.
      for(const visit of available)if(visit.id!=null)state.known.add(String(visit.id));
      state.baseline=true;return;
    }
    for(const row of available)visitEvent(row);
  }
  function snapshot(m){
    if(!m?.id)return;
    const key=stageKey(m);
    if(state.id!==String(m.id)||state.stage!==key){initialize(m,key);return}
    const old=state.last;state.last=m;
    if(!old||!state.instance)return;
    if(!sameLeg(old,m)){
      state.transitions.length=0;clearTimer();
      if(key?.startsWith('x01:'))state.instance.syncSnapshot(scores(m),{resetEffects:true});
      return;
    }
    if(old.updated_at===m.updated_at&&old.turn_player_id===m.turn_player_id&&
       old.player1_score===m.player1_score&&old.player2_score===m.player2_score)return;
    const from=slot(old,old.turn_player_id),to=slot(m,m.turn_player_id);
    if(key?.startsWith('cricket')){
      if(old.status==='playing'&&m.status==='playing'&&from&&to&&from!==to){
        state.instance.emit({type:'turn_changed',
          id:'spectator-cricket:'+m.id+':'+(m.updated_at||'')+':'+to,
          matchId:String(m.id),previousSlot:from,nextSlot:to});
      }
      return;
    }
    if(key?.startsWith('x01:')){
      if(old.status==='playing'&&['playing','finished'].includes(m.status)&&
         (from!==to||old.player1_score!==m.player1_score||old.player2_score!==m.player2_score)){
        for(const [id,event] of state.queued)if(Date.now()-event.at>4500)state.queued.delete(id);
        state.transitions.push({before:old,after:m,at:Date.now(),
          visits:[...state.queued.values()].map(x=>x.row)});
        if(state.transitions.length>10)state.transitions.shift();
        reconcile();
      }
      clearTimer();
      state.reconcileTimer=root.setTimeout(()=>{
        state.reconcileTimer=null;state.transitions=state.transitions.filter(t=>Date.now()-t.at<4500);
        state.instance?.syncSnapshot(scores(state.last));
      },1350);
    }
  }
  function destroy(){
    clearFx();state.id=null;state.stage=null;state.last=null;state.baseline=false;state.known.clear();state.consumed.clear();state.queued.clear();
  }
  root.DartArenaSpectatorFX=Object.freeze({snapshot,visits,visitEvent,destroy,stageKey,parse});
  root.addEventListener('pagehide',destroy,{once:true});
})(window);
