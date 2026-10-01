(()=>{
  if(window.__dartArenaClientErrorLog||!window.supabase)return;
  window.__dartArenaClientErrorLog=true;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const seen=new Map();
  let userId=null;
  db.auth.getSession().then(({data})=>{userId=data.session?.user?.id||null}).catch(()=>{});
  const params=new URLSearchParams(location.search);
  const rawId=params.get('id');
  const matchId=/^[0-9a-f-]{36}$/i.test(rawId||'')?rawId:null;

  async function send(entry){
    if(!userId)return;
    const key=`${entry.message}|${entry.source||''}|${entry.line_no||0}`;
    const now=Date.now(),last=seen.get(key)||0;if(now-last<15000)return;seen.set(key,now);
    if(seen.size>80){for(const [k,t] of seen)if(now-t>60000)seen.delete(k)}
    try{await db.from('client_error_logs').insert({user_id:userId,page:location.pathname.split('/').pop()||'index.html',match_id:matchId,message:String(entry.message||'Ukjent feil').slice(0,1000),source:String(entry.source||'').slice(0,500)||null,line_no:entry.line_no||null,column_no:entry.column_no||null,user_agent:navigator.userAgent.slice(0,500)})}catch{}
  }

  window.addEventListener('error',e=>{
    if(e.target&&e.target!==window){
      const tag=e.target.tagName||'resource';const src=e.target.src||e.target.href||'';
      send({message:`Ressursfeil: ${tag}`,source:src});return;
    }
    send({message:e.message||'JavaScript-feil',source:e.filename,line_no:e.lineno,column_no:e.colno});
  },true);
  window.addEventListener('unhandledrejection',e=>{
    const r=e.reason;send({message:`Unhandled promise: ${r?.message||String(r||'ukjent')}`,source:r?.stack?String(r.stack).split('\n')[1]||'promise':''});
  });
})();
