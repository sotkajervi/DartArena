(()=>{
  if(window.__dartArenaChallengeTimestamps)return;
  window.__dartArenaChallengeTimestamps=true;

  const style=document.createElement('style');
  style.textContent='.challenge-time{color:#789498;font-size:11px;font-weight:700;white-space:nowrap}';
  document.head.appendChild(style);

  function stamp(createdAt,prefix){
    const d=new Date(createdAt);
    if(Number.isNaN(d.getTime()))return'';
    const now=new Date();
    const time=d.toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'});
    const dayKey=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
    const days=Math.round((dayKey(now)-dayKey(d))/86400000);
    if(days===0)return`${prefix} kl. ${time}`;
    if(days===1)return`${prefix} i går ${time}`;
    const date=d.toLocaleDateString('nb-NO',{day:'2-digit',month:'2-digit'});
    return`${prefix} ${date} ${time}`;
  }

  function setTime(row,text){
    const status=row?.querySelector('.status');
    if(!status||!text)return;
    let el=status.querySelector('.challenge-time');
    if(!el){
      el=document.createElement('span');
      el.className='challenge-time';
      status.append(' ',el);
    }
    el.textContent=`• ${text}`;
  }

  async function fetchTimes(){
    if(typeof db==='undefined'||typeof profile==='undefined'||!profile?.id||typeof activeMatch==='undefined'||activeMatch)return null;
    const [{data:incoming,error:incomingError},{data:sent,error:sentError}]=await Promise.all([
      db.from('challenges').select('id,created_at').eq('challenged_id',profile.id).eq('status','pending').order('created_at',{ascending:false}),
      db.from('challenges').select('id,created_at,status').eq('challenger_id',profile.id).in('status',['pending','room']).order('created_at',{ascending:false})
    ]);
    return{
      incoming:incomingError?[]:(incoming||[]),
      sent:sentError?[]:(sent||[])
    };
  }

  function applyTimes(times){
    if(!times)return;
    const incomingButtons=[...document.querySelectorAll('#challengeList .challenge-actions button[data-id]')];
    for(const c of times.incoming){
      const button=incomingButtons.find(b=>b.dataset.id===c.id);
      setTime(button?.closest('.challenge-row'),stamp(c.created_at,'Mottatt'));
    }
    const sentButtons=[...document.querySelectorAll('#sentChallengeList .challenge-actions button[data-id]')];
    for(const c of times.sent){
      const button=sentButtons.find(b=>b.dataset.id===c.id);
      setTime(button?.closest('.challenge-row'),stamp(c.created_at,'Sendt'));
    }
  }

  function hook(){
    if(window.__dartArenaChallengeTimestampHook||typeof loadChallenges!=='function')return false;
    window.__dartArenaChallengeTimestampHook=true;
    const baseLoadChallenges=loadChallenges;
    loadChallenges=async function(...args){
      let times=null;
      try{times=await fetchTimes()}catch{}
      const result=await baseLoadChallenges.apply(this,args);
      applyTimes(times);
      return result;
    };
    return true;
  }

  // Scripts are loaded in order, but keep a few finite retries for slow startup.
  let attempts=0;
  const start=()=>{
    if(hook())return;
    attempts+=1;
    if(attempts<20)setTimeout(start,50);
  };
  start();
})();