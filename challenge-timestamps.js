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
    if(!el){el=document.createElement('span');el.className='challenge-time';status.append(' ',el)}
    el.textContent=`• ${text}`;
  }

  async function refresh(){
    if(typeof db==='undefined'||typeof profile==='undefined'||!profile?.id||typeof activeMatch==='undefined'||activeMatch)return;
    const [{data:incoming,error:incomingError},{data:sent,error:sentError}]=await Promise.all([
      db.from('challenges').select('id,created_at').eq('challenged_id',profile.id).eq('status','pending').order('created_at',{ascending:false}),
      db.from('challenges').select('id,created_at').eq('challenger_id',profile.id).eq('status','pending').order('created_at',{ascending:false})
    ]);
    if(!incomingError){
      const buttons=[...document.querySelectorAll('#challengeList .challenge-actions button[data-id]')];
      for(const c of incoming||[]){
        const button=buttons.find(b=>b.dataset.id===c.id);
        setTime(button?.closest('.challenge-row'),stamp(c.created_at,'Mottatt'));
      }
    }
    if(!sentError){
      const buttons=[...document.querySelectorAll('#sentChallengeList .withdraw-challenge[data-id]')];
      for(const c of sent||[]){
        const button=buttons.find(b=>b.dataset.id===c.id);
        setTime(button?.closest('.challenge-row'),stamp(c.created_at,'Sendt'));
      }
    }
  }

  let lastSignature='';
  async function tick(){
    if(typeof profile==='undefined'||!profile?.id)return;
    const signature=[...document.querySelectorAll('#challengeList [data-id],#sentChallengeList [data-id]')].map(x=>x.dataset.id).join('|');
    if(signature!==lastSignature||document.querySelectorAll('.challenge-row .challenge-time').length===0){
      lastSignature=signature;
      await refresh().catch(()=>{});
    }
  }

  setInterval(tick,700);
  setTimeout(tick,100);
})();
