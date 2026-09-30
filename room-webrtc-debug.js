(()=>{
  if(window.__dartArenaRoomWebrtcDebug)return;
  window.__dartArenaRoomWebrtcDebug=true;

  const logs=[];
  const maxLogs=80;
  let lastStats={videoBytes:0,audioBytes:0,frames:0};

  function safe(fn,fallback='–'){
    try{const v=fn();return v===undefined||v===null||v===''?fallback:v}catch{return fallback}
  }
  function stamp(){return new Date().toLocaleTimeString('nb-NO',{hour12:false})}
  function log(message,data){
    const line=`${stamp()}  ${message}${data!==undefined?'  '+(typeof data==='string'?data:JSON.stringify(data)):''}`;
    logs.unshift(line);
    if(logs.length>maxLogs)logs.length=maxLogs;
    renderLogs();
    console.debug('[ROOM WEBRTC]',message,data??'');
  }

  function buildUi(){
    if(document.getElementById('roomWebrtcDebug'))return;
    const host=document.createElement('section');
    host.id='roomWebrtcDebug';
    host.className='card';
    host.style.cssText='margin-top:16px;border-color:rgba(255,184,71,.42);background:rgba(17,15,8,.82)';
    host.innerHTML=`
      <div class="heading">
        <div><small style="color:#ffbd59">WEBRTC DEBUG</small><h2 style="margin-bottom:0">Venterom</h2></div>
        <div class="top-actions"><button id="roomDebugCopy" class="outline small-btn" type="button">Kopier debug</button><button id="roomDebugReconnect" class="outline small-btn" type="button">Tving reconnect</button></div>
      </div>
      <div id="roomDebugState" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace"></div>
      <details open style="margin-top:12px"><summary style="cursor:pointer;font-weight:800">Signal-logg</summary><pre id="roomDebugLog" style="white-space:pre-wrap;overflow:auto;max-height:260px;margin:10px 0 0;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:#05090a;color:#d8e5e6;font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace"></pre></details>`;
    const anchor=document.querySelector('.room-options')||document.querySelector('main.shell');
    if(anchor?.parentNode)anchor.insertAdjacentElement('beforebegin',host);else document.querySelector('main.shell')?.appendChild(host);
    document.getElementById('roomDebugCopy')?.addEventListener('click',copyDebug);
    document.getElementById('roomDebugReconnect')?.addEventListener('click',async()=>{
      log('MANUAL reconnect requested');
      try{await restartPeer()}catch(error){log('MANUAL reconnect error',error?.message||String(error))}
    });
  }

  function stateRow(label,value){
    return `<div style="padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(0,0,0,.18)"><b style="display:block;color:#8ea5a8;font-size:10px;letter-spacing:.05em">${label}</b><span>${String(value)}</span></div>`;
  }

  async function collectStats(){
    if(typeof pc==='undefined'||!pc||typeof pc.getStats!=='function')return lastStats;
    try{
      const report=await pc.getStats();
      let videoBytes=0,audioBytes=0,frames=0;
      report.forEach(s=>{
        if(s.type==='inbound-rtp'&&!s.isRemote){
          const kind=s.kind||s.mediaType;
          if(kind==='video'){videoBytes+=Number(s.bytesReceived||0);frames+=Number(s.framesDecoded||0)}
          if(kind==='audio')audioBytes+=Number(s.bytesReceived||0);
        }
      });
      lastStats={videoBytes,audioBytes,frames};
    }catch{}
    return lastStats;
  }

  async function renderState(){
    buildUi();
    const stats=await collectStats();
    const el=document.getElementById('roomDebugState');
    if(!el)return;
    const localTracks=safe(()=>stream?.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.enabled?'on':'off'}`).join(', '),'none');
    const remoteTracks=safe(()=>remoteStream?.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.muted?'muted':'live'}`).join(', '),'none');
    const localDesc=safe(()=>pc?.localDescription?.type,'none');
    const remoteDesc=safe(()=>pc?.remoteDescription?.type,'none');
    el.innerHTML=[
      stateRow('ROLE',safe(()=>isOfferer()?'OFFER':'ANSWER')),
      stateRow('LOCAL READY',safe(()=>String(localReady))),
      stateRow('REMOTE READY',safe(()=>String(remoteReady))),
      stateRow('PEER',safe(()=>pc?'exists':'none')),
      stateRow('CONNECTION',safe(()=>pc?.connectionState,'none')),
      stateRow('ICE',safe(()=>pc?.iceConnectionState,'none')),
      stateRow('SIGNALING',safe(()=>pc?.signalingState,'none')),
      stateRow('ICE GATHER',safe(()=>pc?.iceGatheringState,'none')),
      stateRow('LOCAL DESC',localDesc),
      stateRow('REMOTE DESC',remoteDesc),
      stateRow('LOCAL TRACKS',localTracks),
      stateRow('REMOTE TRACKS',remoteTracks),
      stateRow('PENDING ICE',safe(()=>pendingCandidates?.length,0)),
      stateRow('OFFER BUSY',safe(()=>String(offerBusy))),
      stateRow('VIDEO BYTES IN',stats.videoBytes),
      stateRow('VIDEO FRAMES',stats.frames),
      stateRow('AUDIO BYTES IN',stats.audioBytes)
    ].join('');
  }

  function renderLogs(){
    const el=document.getElementById('roomDebugLog');
    if(el)el.textContent=logs.join('\n');
  }

  async function copyDebug(){
    await renderState();
    const state=document.getElementById('roomDebugState')?.innerText||'';
    const text=`DartArena room WebRTC debug\nURL: ${location.href}\nTime: ${new Date().toISOString()}\n\nSTATE\n${state}\n\nLOG\n${logs.join('\n')}`;
    try{await navigator.clipboard.writeText(text);const b=document.getElementById('roomDebugCopy');if(b){const old=b.textContent;b.textContent='Kopiert';setTimeout(()=>b.textContent=old,1200)}}catch{prompt('Kopier debug:',text)}
  }

  function hookAsync(name,formatter){
    try{
      const original=eval(name);
      if(typeof original!=='function')return;
      const wrapped=async function(...args){
        try{log(formatter?formatter(...args):name)}catch{}
        try{return await original.apply(this,args)}catch(error){log(`${name} ERROR`,error?.message||String(error));throw error}
      };
      eval(`${name}=wrapped`);
    }catch{}
  }

  function hookSync(name,formatter){
    try{
      const original=eval(name);
      if(typeof original!=='function')return;
      const wrapped=function(...args){
        try{log(formatter?formatter(...args):name)}catch{}
        try{return original.apply(this,args)}catch(error){log(`${name} ERROR`,error?.message||String(error));throw error}
      };
      eval(`${name}=wrapped`);
    }catch{}
  }

  function installHooks(){
    hookAsync('send',(event,payload)=>`SEND ${event}${payload?.description?.type?' '+payload.description.type:''}${payload?.candidate?' candidate':''}`);
    hookAsync('handleSignal',s=>`RECV signal${s?.description?.type?' '+s.description.type:''}${s?.candidate?' candidate':''}`);
    hookAsync('connectIfReady',()=>`connectIfReady local=${safe(()=>localReady)} remote=${safe(()=>remoteReady)} role=${safe(()=>isOfferer()?'offer':'answer')}`);
    hookAsync('restartPeer',()=>`restartPeer state=${safe(()=>pc?.connectionState,'none')} signal=${safe(()=>pc?.signalingState,'none')}`);
    hookSync('createPeer',()=>`createPeer`);
    hookSync('destroyPeer',()=>`destroyPeer state=${safe(()=>pc?.connectionState,'none')}`);
    hookAsync('showRemote',()=>`showRemote tracks=${safe(()=>remoteStream?.getTracks().length,0)}`);
    log('DEBUG installed');
  }

  buildUi();
  installHooks();
  setInterval(renderState,700);
  window.addEventListener('error',e=>log('WINDOW ERROR',e.message));
  window.addEventListener('unhandledrejection',e=>log('PROMISE ERROR',e.reason?.message||String(e.reason)));
})();
