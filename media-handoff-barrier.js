/* Barrier for seamless SFU handoff: keep waiting-room transport alive
   until both authenticated match clients have new published/subscribed media.
   Broadcasts carry only match id and a validated player id, no media data. */
(()=>{
  'use strict';
  if(window.DartArenaHandoffBarrier)return;
  const valid=id=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id||'');
  async function wait({client,matchId,me,opponent,timeout=12000}={}){
    if(!client||!valid(matchId)||!valid(me)||!valid(opponent)||me===opponent)
      throw new Error('Invalid handoff synchronization participants');
    const channel=client.channel('match-handoff-ready-'+matchId);
    let interval=null,deadline=null,settled=false,subscribed=false;
    let resolveDone,rejectDone;
    const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject});
    function cleanup(){
      clearInterval(interval);clearTimeout(deadline);
      try{client.removeChannel(channel).catch?.(()=>{})}catch{}
    }
    function finish(error){
      if(settled)return;
      settled=true;cleanup();
      if(error)rejectDone(error);else resolveDone(true);
    }
    const send=async()=>{
      if(!subscribed||settled)return false;
      try{
        const result=await channel.send({type:'broadcast',event:'ready',payload:{matchId,from:me}});
        return result==='ok';
      }catch(error){
        console.debug('[HANDOFF BARRIER] broadcast retry',error?.message||error);
        return false;
      }
    };
    channel.on('broadcast',{event:'ready'},async({payload})=>{
      if(payload?.matchId!==matchId||payload?.from!==opponent||settled)return;
      // Ensure our reciprocal ready has been handed to the channel before
      // releasing the waiting-room connection.
      if(!await send())return;
      window.DartArenaMediaTrace?.mark('HANDOFF_BOTH_CLIENTS_READY',{matchId:matchId.slice(0,8)});
      finish();
    }).subscribe(status=>{
      if(settled)return;
      if(status==='SUBSCRIBED'){
        subscribed=true;
        window.DartArenaMediaTrace?.mark('HANDOFF_LOCAL_SFU_READY',{matchId:matchId.slice(0,8)});
        send();
        interval=setInterval(send,400);
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        finish(new Error('Handoff synchronization channel: '+status));
      }
    });
    deadline=setTimeout(()=>finish(new Error('Both-player SFU readiness timeout')),timeout);
    return done;
  }
  window.DartArenaHandoffBarrier=Object.freeze({wait});
})();