/* DartArena media diagnostics. Read-only observation; no track or transport changes.
 * Session data stays in this browser tab until exported or cleared.
 */
(()=>{
  'use strict';
  if(window.DartArenaMediaTrace)return;
  const KEY='dartarena-media-trace-v1';
  const MAX=750;
  let items=[];
  let origin=Date.now();
  let lastState='';
  let lastHeartbeat=0;
  let lastSave=0;
  let tabId='';
  const clean=value=>{
    if(typeof value==='string')return value.replace(/(access_token|refresh_token|apikey|authorization|Bearer)\s*[:=]\s*[^\s,;]+/ig,'$1=[hidden]').slice(0,400);
    if(value instanceof Error)return (value.name+': '+value.message).slice(0,350);
    if(value==null||typeof value==='number'||typeof value==='boolean')return value;
    try{return JSON.stringify(value).slice(0,350)}catch{return '[object]'}
  };
  try{
    const previous=JSON.parse(sessionStorage.getItem(KEY)||'null');
    if(previous?.version===1&&Array.isArray(previous.events)){
      items=previous.events.slice(-MAX);
      tabId=previous.tabId||'';
      origin=previous.started||origin;
    }
  }catch{}
  if(!tabId)tabId=Math.random().toString(36).slice(2,10);
  const save=()=>{
    try{sessionStorage.setItem(KEY,JSON.stringify({version:1,tabId,started:origin,events:items}))}catch{}
  };
  function log(type,data={}){
    const record={time:new Date().toISOString(),ms:Date.now()-origin,type};
    if(data&&Object.keys(data).length)record.data=data;
    items.push(record);
    if(items.length>MAX)items.splice(0,items.length-MAX);
    if(Date.now()-lastSave>1800){save();lastSave=Date.now()}
  }
  function mark(label,detail){
    log('MARK',{label:String(label).slice(0,90),detail:clean(detail)});
    save();
  }
  function trackInfo(stream){
    if(!stream||typeof stream.getTracks!=='function')return null;
    try{return stream.getTracks().map(t=>({
      id:String(t.id||'').slice(0,12),kind:t.kind,state:t.readyState,
      muted:!!t.muted,enabled:!!t.enabled
    }))}catch{return null}
  }
  function video(id){
    const v=document.getElementById(id);
    if(!v)return null;
    return {
      stream:trackInfo(v.srcObject),paused:v.paused,muted:v.muted,
      ready:v.readyState,size:[v.videoWidth||0,v.videoHeight||0],
      current:Math.round((v.currentTime||0)*10)/10
    };
  }
  function peer(pc){
    if(!pc)return null;
    return {connection:pc.connectionState||'',ice:pc.iceConnectionState||'',signaling:pc.signalingState||''};
  }
  function snapshot(){
    const room=window.DartArenaTournamentRoomState;
    const challenge=window.DartArenaChallengeRoomState;
    const match=window.DartArenaMatchEngineState;
    const mode=window.DARTARENA_ACTIVE_MEDIA_MODE||window.DartArenaMatchMedia?.mode||window.DartArenaRoomMedia?.mode||'';
    return {
      page:location.pathname.split('/').pop(),
      scene:!!document.body.classList.contains('match-page'),
      mode,online:navigator.onLine,visible:!document.hidden,
      local:video('localVideo'),remote:video('remoteVideo'),
      tournamentRoom:room?{ready:room.ready?.(),capture:trackInfo(room.stream?.()),
        publication:!!room.publication?.()?.sessionId,peer:peer(room.publisher?.()?.subscriber)}:null,
      challengeRoom:challenge?{capture:trackInfo(challenge.stream?.()),peer:peer(challenge.peer?.())}:null,
      match:match?{capture:trackInfo(match.stream?.()),ready:match.ready?.(),
        peer:peer(match.peer?.()),sfuReady:!!window.DartArenaMatchMedia?.readyForHandoff?.()}:null,
      placeholder:(document.getElementById('remotePlaceholder')?.textContent||'').trim().slice(0,90)
    };
  }
  const significant=s=>{
    const clone=JSON.parse(JSON.stringify(s));
    // Playback time changes are normal; log video track and playback state changes, not frames.
    if(clone.local)delete clone.local.current;
    if(clone.remote)delete clone.remote.current;
    return JSON.stringify(clone);
  };
  function observe(){
    try{
      const state=snapshot();
      const fingerprint=significant(state);
      if(fingerprint!==lastState){
        lastState=fingerprint;
        log('STATE',state);
      }else if(Date.now()-lastHeartbeat>7000){
        lastHeartbeat=Date.now();
        log('HEARTBEAT',{page:state.page,scene:state.scene,mode:state.mode,remote:state.remote?.stream,match:state.match?.sfuReady});
      }
    }catch(e){log('TRACE_ERROR',{message:clean(e)})}
  }
  const original={};
  for(const level of ['warn','error','debug']){
    original[level]=console[level];
    console[level]=function(...args){
      try{
        const first=args.length?String(args[0]):'';
        if(level!=='debug'||/SFU|MEDIA|HANDOFF|TOURNAMENT|ROOM|WEBRTC|CLOUD|SUBSCRI|PUBLISH/i.test(first)){
          log('CONSOLE_'+level.toUpperCase(),{message:args.slice(0,3).map(clean).join(' ').slice(0,550)});
        }
      }catch{}
      return original[level].apply(this,args);
    };
  }
  window.addEventListener('error',e=>log('SCRIPT_ERROR',{message:clean(e.message),file:(e.filename||'').split('/').pop(),line:e.lineno}));
  window.addEventListener('unhandledrejection',e=>log('UNHANDLED_REJECTION',{message:clean(e.reason)}));
  window.addEventListener('pagehide',()=>{mark('PAGE_HIDE');save()});
  window.addEventListener('pageshow',()=>mark('PAGE_SHOW'));
  document.addEventListener('visibilitychange',()=>mark('VISIBILITY',document.hidden?'hidden':'visible'));
  function exportLog(){
    observe();save();
    const payload={
      version:1,tabId,started:new Date(origin).toISOString(),
      exported:new Date().toISOString(),
      userAgent:navigator.userAgent,
      notes:'No raw audio, video, account tokens or device labels recorded.',
      events:items
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    const time=new Date().toISOString().replace(/[:.]/g,'-');
    link.download='dartarena-medielogg-'+tabId+'-'+time+'.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    mark('LOG_EXPORTED');
  }
  function makeButton(){
    if(!document.body||document.getElementById('dartarenaMediaTraceButton'))return;
    const btn=document.createElement('button');
    btn.id='dartarenaMediaTraceButton';
    btn.type='button';
    btn.textContent='Last ned medielogg';
    btn.title='Lagre video- og lydhendelser fra denne fanen for feilsøking';
    btn.style.cssText='position:fixed;bottom:10px;left:10px;z-index:2147483000;padding:7px 11px;border:1px solid #00d5df;border-radius:8px;background:#082226;color:#eaffff;font:600 12px system-ui;box-shadow:0 2px 12px #0009;cursor:pointer;opacity:.87';
    btn.addEventListener('click',exportLog);
    document.body.appendChild(btn);
  }
  window.DartArenaMediaTrace=Object.freeze({mark,export:exportLog,observe,events:()=>items.length});
  mark('TRACE_STARTED',{page:location.pathname.split('/').pop()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeButton,{once:true});
  else makeButton();
  setInterval(()=>{observe();if(Date.now()-lastSave>4000){save();lastSave=Date.now()}},500);
})();
