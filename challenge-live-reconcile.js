(()=>{
  if(window.__dartArenaChallengeLiveReconcile)return;
  window.__dartArenaChallengeLiveReconcile=true;

  let busy=false,lastSignature=null;
  const seenIncoming=new Set();
  let audioContext=null;
  let pendingTada=false;

  function ensureAlertStyles(){
    if(document.getElementById('dartarena-challenge-alert-styles'))return;
    const style=document.createElement('style');
    style.id='dartarena-challenge-alert-styles';
    style.textContent=`
      .challenge-alert-card{position:relative;transition:border-color .2s ease,box-shadow .2s ease,background .2s ease}
      .challenge-alert-card.incoming-challenge-active{border-color:rgba(0,234,244,.92)!important;box-shadow:0 0 0 2px rgba(0,234,244,.16),0 0 30px rgba(0,234,244,.18);animation:challengeCardPulse 1.25s ease-in-out infinite alternate}
      .challenge-alert-badge{display:none;align-items:center;gap:6px;margin-left:auto;padding:5px 9px;border-radius:999px;border:1px solid rgba(0,234,244,.7);background:rgba(0,234,244,.13);color:#00eaf4;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
      .incoming-challenge-active .challenge-alert-badge{display:inline-flex}
      .incoming-challenge-active .challenge-alert-badge:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor;animation:challengeBadgeBlink .75s steps(2,end) infinite}
      #challengeList .challenge-row.incoming-challenge-row{border-color:rgba(0,234,244,.55);background:rgba(0,234,244,.055)}
      #challengeList .challenge-row.incoming-challenge-row .player-name{color:#00eaf4;font-weight:950}
      @keyframes challengeCardPulse{from{box-shadow:0 0 0 1px rgba(0,234,244,.12),0 0 14px rgba(0,234,244,.08)}to{box-shadow:0 0 0 3px rgba(0,234,244,.24),0 0 34px rgba(0,234,244,.28)}}
      @keyframes challengeBadgeBlink{50%{opacity:.25}}
      @media(prefers-reduced-motion:reduce){.challenge-alert-card.incoming-challenge-active,.incoming-challenge-active .challenge-alert-badge:before{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function getAudioContext(){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!audioContext)audioContext=new Ctx();
    return audioContext;
  }

  function tone(ctx,frequency,start,duration,gainValue){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(gainValue,start+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start+duration+.03);
  }

  function playTada(){
    try{
      const ctx=getAudioContext();
      if(!ctx||ctx.state!=='running'){
        pendingTada=true;
        return;
      }
      const t=ctx.currentTime+.025;
      tone(ctx,523.25,t,.22,.11);
      tone(ctx,659.25,t+.13,.25,.12);
      tone(ctx,783.99,t+.27,.36,.13);
      tone(ctx,1046.5,t+.43,.52,.15);
    }catch{}
  }

  async function unlockAudio(){
    try{
      const ctx=getAudioContext();
      if(!ctx)return;
      if(ctx.state==='suspended')await ctx.resume();
      if(pendingTada&&ctx.state==='running'){
        pendingTada=false;
        playTada();
      }
    }catch{}
  }

  function syncIncomingAlert(){
    const list=document.getElementById('challengeList');
    const card=list?.closest('.card');
    if(!list||!card)return;
    ensureAlertStyles();
    card.classList.add('challenge-alert-card');

    const heading=card.querySelector('.heading');
    let badge=card.querySelector('.challenge-alert-badge');
    if(!badge&&heading){
      badge=document.createElement('span');
      badge.className='challenge-alert-badge';
      badge.textContent='Ny utfordring';
      heading.appendChild(badge);
    }

    const rows=[...list.querySelectorAll('.challenge-row')];
    const entries=rows.map(row=>({row,id:row.querySelector('[data-id]')?.dataset.id||''})).filter(x=>x.id);
    const active=entries.length>0;
    card.classList.toggle('incoming-challenge-active',active);
    entries.forEach(({row})=>row.classList.add('incoming-challenge-row'));

    const fresh=entries.filter(({id})=>!seenIncoming.has(id));
    entries.forEach(({id})=>seenIncoming.add(id));
    if(fresh.length)playTada();
  }

  ['pointerdown','keydown','touchstart'].forEach(type=>window.addEventListener(type,unlockAudio,{passive:true,capture:true}));

  const listObserver=new MutationObserver(()=>syncIncomingAlert());
  const challengeList=document.getElementById('challengeList');
  if(challengeList)listObserver.observe(challengeList,{childList:true,subtree:true});
  syncIncomingAlert();

  async function reconcile(force=false){
    if(busy||document.hidden)return;
    if(typeof db==='undefined'||typeof profile==='undefined'||!profile?.id||typeof loadChallenges!=='function')return;
    if(typeof activeMatch!=='undefined'&&activeMatch){lastSignature=null;return}

    busy=true;
    try{
      const{data,error}=await db.from('challenges')
        .select('id,challenger_id,challenged_id,status,created_at')
        .or(`challenger_id.eq.${profile.id},challenged_id.eq.${profile.id}`)
        .in('status',['pending','room'])
        .order('created_at',{ascending:false});
      if(error)return;

      const signature=(data||[])
        .map(c=>`${c.id}:${c.challenger_id}:${c.challenged_id}:${c.status}`)
        .join('|');

      if(force||signature!==lastSignature){
        lastSignature=signature;
        await loadChallenges();
        syncIncomingAlert();
      }
    }catch(e){
      console.warn('Challenge live reconcile failed',e);
    }finally{
      busy=false;
    }
  }

  setInterval(()=>reconcile(false),1000);
  window.addEventListener('focus',()=>reconcile(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile(true)});
  window.addEventListener('pagehide',()=>{listObserver.disconnect();try{audioContext?.close()}catch{}},{once:true});
  setTimeout(()=>reconcile(true),250);
})();
