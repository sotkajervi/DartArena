(()=>{
  const list=document.getElementById('challengeList');
  if(!list||list.dataset.challengeAlertReady==='1')return;
  list.dataset.challengeAlertReady='1';

  const card=list.closest('.card');
  if(!card)return;
  card.classList.add('challenge-alert-card');

  const heading=card.querySelector('.heading');
  let badge=card.querySelector('.challenge-alert-badge');
  if(!badge&&heading){
    badge=document.createElement('span');
    badge.className='challenge-alert-badge';
    badge.textContent='Ny utfordring';
    heading.appendChild(badge);
  }

  const seen=new Set();
  let audioContext=null;
  let pendingSound=false;
  let firstScan=true;

  function getAudioContext(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return null;
    if(!audioContext)audioContext=new AudioCtx();
    return audioContext;
  }

  async function unlockAudio(){
    try{
      const ctx=getAudioContext();
      if(!ctx)return;
      if(ctx.state==='suspended')await ctx.resume();
      if(pendingSound&&ctx.state==='running'){
        pendingSound=false;
        playTada();
      }
    }catch{}
  }

  function tone(ctx,frequency,start,duration,gainValue){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(gainValue,start+.018);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start+duration+.03);
  }

  function playTada(){
    try{
      const ctx=getAudioContext();
      if(!ctx||ctx.state!=='running'){
        pendingSound=true;
        return;
      }
      const t=ctx.currentTime+.025;
      tone(ctx,523.25,t,.22,.11);
      tone(ctx,659.25,t+.13,.25,.12);
      tone(ctx,783.99,t+.27,.36,.13);
      tone(ctx,1046.50,t+.43,.52,.15);
    }catch{}
  }

  function idsFromRows(){
    const rows=[...list.querySelectorAll('.challenge-row')];
    return rows.map(row=>{
      const control=row.querySelector('[data-id]');
      return {row,id:control?.dataset.id||''};
    }).filter(x=>x.id);
  }

  function sync(){
    const entries=idsFromRows();
    const hasIncoming=entries.length>0;
    card.classList.toggle('incoming-challenge-active',hasIncoming);
    entries.forEach(({row})=>row.classList.add('incoming-challenge-row'));

    const fresh=entries.filter(({id})=>!seen.has(id));
    entries.forEach(({id})=>seen.add(id));
    if(fresh.length){
      if(firstScan&&document.visibilityState==='hidden')pendingSound=true;
      else playTada();
    }
    firstScan=false;
  }

  ['pointerdown','keydown','touchstart'].forEach(type=>{
    window.addEventListener(type,unlockAudio,{passive:true,capture:true});
  });

  const observer=new MutationObserver(sync);
  observer.observe(list,{childList:true,subtree:true});
  sync();

  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    try{audioContext?.close()}catch{}
  },{once:true});
})();
