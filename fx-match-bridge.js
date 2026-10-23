/* DartArena FX: read-only bridge for authenticated online X01 match rooms.
   Visual effects are driven by committed match_throws INSERTs + match UPDATEs.
   No score mutation, WebRTC control, or user-facing FX switches. */
(()=>{
'use strict';
const FX=window.DartArenaFXLive;
const mid=new URLSearchParams(location.search).get('id');
if(!FX||!mid||!window.supabase)return;
const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
const effects={...FX.DEFAULT_EFFECTS,neon_relay:false};
let fx=null,stage=null,cached=null,me=null,channel=null,disposed=false;
const transitions=[],pending=new Map(),seen=new Set();
const scorePair=m=>({p1:Number(m?.player1_score),p2:Number(m?.player2_score)});
const slotOf=(m,id)=>id===m?.player1_id?'p1':id===m?.player2_id?'p2':null;
const numeric=n=>Number.isInteger(n)&&n>=0&&n<=1001;
const stageKey=m=>{
  if(!m)return null;
  const chicago=String(m.game_config?.chicago??'false').toLowerCase()==='true';
  if(chicago){
    const stage=Number(m.game_config?.chicago_stage||m.current_leg||1);
    if(stage!==1&&stage!==3)return null;
    return 'chicago:'+stage+':'+(stage===1?301:501);
  }
  const start=Number(m.game);
  return [170,301,501,1001].includes(start)?'x01:'+start:null;
};
const startScore=m=>{
  const key=stageKey(m);return key?Number(key.split(':').at(-1)):null;
};
function setupFx(m){
  if(disposed)return;
  const key=stageKey(m);
  if(key===stage&&fx)return;
  fx?.destroy();fx=null;stage=key;
  if(!key||!me||![m.player1_id,m.player2_id].includes(me))return;
  const localP1=me===m.player1_id;
  try{
    fx=FX.createX01({matchId:mid,level:'cinematic',effects,startScore:startScore(m),
      initialScores:scorePair(m),
      slots:{
        p1:{score:'#matchScore1',card:'#matchP1',camera:localP1?'#localVideoCard':'#remoteVideoCard'},
        p2:{score:'#matchScore2',card:'#matchP2',camera:localP1?'#remoteVideoCard':'#localVideoCard'}
      }});
  }catch(err){console.warn('Match FX unavailable',err)}
}
function comparable(a,b){
  if(!a||!b)return false;
  return Number(a.current_set||1)===Number(b.current_set||1)&&
    Number(a.current_leg||1)===Number(b.current_leg||1)&&stageKey(a)===stageKey(b);
}
function parseTransition(before,after,visit){
  if(!before||!after||!visit||String(visit.match_id)!==String(mid))return null;
  if(before.status!=='playing'||!['playing','finished'].includes(after.status))return null;
  if(!comparable(before,after))return null;
  if(Number(visit.set_no||1)!==Number(before.current_set||1)||
     Number(visit.leg_no||1)!==Number(before.current_leg||1))return null;
  if(before.turn_player_id!==visit.player_id)return null;
  // A real visit hands the turn to the opponent, unless checkout finishes
  // the match. Score corrections are UPDATEs and do not hand over the turn.
  if(after.status==='playing'&&after.turn_player_id===before.turn_player_id)return null;
  if(after.status==='finished'&&(visit.is_checkout!==true||after.winner_id!==visit.player_id))return null;
  const playerSlot=slotOf(before,visit.player_id);
  if(!playerSlot)return null;
  const beforeScores=scorePair(before),afterScores=scorePair(after);
  if(!Object.values(beforeScores).every(numeric)||!Object.values(afterScores).every(numeric))return null;
  const scored=Number(visit.score),old=beforeScores[playerSlot],next=afterScores[playerSlot];
  if(!Number.isInteger(scored)||scored<0||scored>180)return null;
  // Non-scoring BUST/0 visits can change turns without changing remaining.
  // A changed score must correspond precisely to the recorded committed visit.
  const bust=old===next&&scored>0;
  if(!(old===next||old-next===scored))return null;
  if(old-next!==scored&&!bust)return null;
  if(afterScores[playerSlot==='p1'?'p2':'p1']!==beforeScores[playerSlot==='p1'?'p2':'p1'])return null;
  const nextTurnSlot=slotOf(after,after.turn_player_id);
  const previousTurnSlot=slotOf(before,before.turn_player_id);
  if(!bust&&scored>0&&old-next!==scored)return null;
  if(after.status==='playing'&&nextTurnSlot!==null&&nextTurnSlot===previousTurnSlot&&
     old===next&&scored===0)return null;
  return {confirmed:true,eventId:'online:'+mid+':'+visit.id,playerSlot,
    previousScore:old,newScore:next,scored,bust,checkout:visit.is_checkout===true,
    previousTurnSlot,nextTurnSlot,legEnded:!comparable(before,after),
    matchEnded:after.status==='finished',beforeScores,afterScores};
}
function apply(visit){
  if(disposed||!visit?.id||seen.has(String(visit.id)))return;
  let found=null;
  // A DB update and a committed visit can arrive in either order.
  for(let i=0;i<transitions.length;i++){
    const t=transitions[i];
    const candidate=parseTransition(t.before,t.after,visit);
    if(!candidate)continue;
    found={candidate,index:i,before:t.before,after:t.after};break;
  }
  if(!found)return;
  const {candidate,index,before,after}=found;
  seen.add(String(visit.id));if(seen.size>500)seen.clear();
  pending.delete(String(visit.id));transitions.splice(0,index+1);
  setupFx(before);
  if(!fx)return;
  fx.syncSnapshot(candidate.beforeScores);
  fx.acceptConfirmedOnlineVisit(candidate);
  // Do not reset score rails immediately; the FX engine animates their new state.
}
function checkPending(){for(const row of [...pending.values()])apply(row)}
function updateMatch(next){
  if(disposed||!next||String(next.id)!==String(mid))return;
  const before=cached;cached=next;
  if(before){
    const changed=before.turn_player_id!==next.turn_player_id||
      before.player1_score!==next.player1_score||
      before.player2_score!==next.player2_score||
      before.current_leg!==next.current_leg||
      before.current_set!==next.current_set||
      before.status!==next.status;
    if(changed){
      transitions.push({before,after:next});
      if(transitions.length>24)transitions.shift();
    }
  }
  const newStage=stageKey(next);
  if(stage!==newStage){
    setupFx(next);
    fx?.syncSnapshot(scorePair(next),{resetEffects:true});
    transitions.length=0;pending.clear();
    return;
  }
  if(before&&!comparable(before,next)){
    fx?.syncSnapshot(scorePair(next),{resetEffects:true});
    // Ensure old-leg visits never animate after the new leg starts.
    transitions.length=0;pending.clear();
    return;
  }
  checkPending();
}
function queueVisit(row){
  if(disposed||!row?.id||row.match_id!==mid||seen.has(String(row.id)))return;
  pending.set(String(row.id),row);
  if(pending.size>30)pending.delete(pending.keys().next().value);
  checkPending();
}
async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||disposed)return;
  me=session.user.id;
  const {data:match,error}=await db.from('matches').select('*').eq('id',mid).single();
  if(error||!match||![match.player1_id,match.player2_id].includes(me)||disposed)return;
  cached=match;setupFx(match);
  channel=db.channel('dartarena-fx-'+mid)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'id=eq.'+mid},
      payload=>updateMatch(payload.new))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'match_throws',filter:'match_id=eq.'+mid},
      payload=>queueVisit(payload.new))
    .subscribe();
}
function cleanup(){
  if(disposed)return;disposed=true;
  fx?.destroy();fx=null;stage=null;
  if(channel){try{db.removeChannel(channel)}catch{}channel=null}
  transitions.length=0;pending.clear();seen.clear();
}
window.addEventListener('pagehide',cleanup);
boot().catch(err=>console.warn('Match FX bridge unavailable',err));
})();
