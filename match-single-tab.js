(()=>{
  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId)return;
  const key=`dartarena-active-match-tab:${matchId}`;
  const tabId=(crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`);
  const now=Date.now();
  let current=null;
  try{current=JSON.parse(localStorage.getItem(key)||'null')}catch{}
  // A live tab already owns this match. Stop this duplicate before match.js can start camera/WebRTC.
  if(current?.id&&current.id!==tabId&&now-Number(current.ts||0)<8000){
    window.__DARTARENA_DUPLICATE_MATCH__=true;
    window.stop();
    try{window.opener?.focus()}catch{}
    try{window.close()}catch{}
    if(!window.closed){
      document.documentElement.innerHTML='<head><title>DartArena</title></head><body style="margin:0;background:#071012;color:#dcebed;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><div style="text-align:center"><h2>Kampen er allerede åpen</h2><p>Bruk den eksisterende kampfanen.</p></div></body>';
    }
    return;
  }
  const write=()=>{try{localStorage.setItem(key,JSON.stringify({id:tabId,ts:Date.now()}))}catch{}};
  write();
  const heartbeat=setInterval(write,2000);
  const release=()=>{clearInterval(heartbeat);try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v?.id===tabId)localStorage.removeItem(key)}catch{}};
  addEventListener('pagehide',release,{once:true});
  addEventListener('beforeunload',release,{once:true});
})();