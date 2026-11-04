/* Lightweight 61 countdown: the existing game clock is authoritative.
   No sound files, no network requests; only brief Web Audio oscillators. */
(()=>{
  'use strict';
  if(window.DartArena61Countdown)return;
  const clock=document.getElementById('clock');
  if(!clock)return;
  const isMatch=document.body.classList.contains('sixty-one-match-page');
  const KEY='dartarena-61-countdown-muted';
  let muted=false,ctx=null,lastSecond=null,lastChange=0;
  try{muted=localStorage.getItem(KEY)==='1'}catch{}

  const holder=document.createElement('div');
  holder.className='sixty-one-clock-sound';
  const button=document.createElement('button');
  button.type='button';
  button.className='outline sixty-one-sound-toggle';
  holder.appendChild(button);
  clock.insertAdjacentElement('afterend',holder);
  const paintButton=()=>{
    button.textContent=muted?'🔇 Pip av':'🔊 Pip på';
    button.setAttribute('aria-label',muted?'Slå på nedtellingslyd':'Slå av nedtellingslyd');
    button.setAttribute('aria-pressed',String(!muted));
    button.title='61: lydsignal de siste 10 sekundene';
  };
  paintButton();

  const unlock=()=>{
    if(muted||ctx)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    try{ctx=new Audio();ctx.resume().catch(()=>{})}catch{ctx=null}
  };
  button.addEventListener('click',()=>{
    muted=!muted;
    try{localStorage.setItem(KEY,muted?'1':'0')}catch{}
    if(!muted)unlock();
    paintButton();
  });
  // Browsers require a user gesture to start sound. Online participants may
  // not be the person pressing the shared Start button.
  document.addEventListener('pointerdown',unlock,{passive:true});
  document.addEventListener('keydown',unlock);

  function active(){
    if(document.hidden||clock.classList.contains('paused'))return false;
    if(isMatch){
      return typeof m!=='undefined'&&m?.status==='playing'&&
        typeof state!=='undefined'&&!!state?.game_started_at&&
        !state?.is_paused&&!state?.sudden_death;
    }
    return typeof running!=='undefined'&&running===true&&
      !document.getElementById('gameCard')?.classList.contains('hidden');
  }
  function beep(second){
    if(muted||!ctx||ctx.state!=='running')return;
    try{
      const now=ctx.currentTime;
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type='sine';
      oscillator.frequency.value=second===0?660:second<=5?900:740;
      const duration=second===0?0.36:second<=5?0.14:0.085;
      gain.gain.setValueAtTime(0,now);
      gain.gain.linearRampToValueAtTime(.065,now+.008);
      gain.gain.setValueAtTime(.065,now+Math.max(.009,duration-.035));
      gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(now);oscillator.stop(now+duration+.015);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
    }catch(error){console.debug('[61 countdown] lyd utilgjengelig',error)}
  }
  function update(){
    const valid=active();
    const t=clock.textContent.trim();
    const parts=/^(\d+):(\d{2})$/.exec(t);
    const seconds=parts?Number(parts[1])*60+Number(parts[2]):null;
    clock.classList.toggle('sixty-one-countdown',valid&&seconds!==null&&seconds<=10);
    clock.classList.toggle('sixty-one-countdown-urgent',valid&&seconds!==null&&seconds<=5);
    if(!valid||seconds===null||seconds>10){
      // Solo completes at 0 before the observer callback runs. Preserve
      // the final signal only for a natural 1 -> 0 transition.
      if(seconds===0&&!document.hidden&&!clock.classList.contains('paused')&&
         lastSecond===1&&Date.now()-lastChange<2200)beep(0);
      lastSecond=null;
      lastChange=0;
      return;
    }
    if(seconds===lastSecond)return;
    const now=Date.now();
    // Never replay seconds or sound a delayed alarm after switching tabs.
    // 0 only rings when the preceding second was observed normally.
    const sequential=lastSecond!==null&&lastSecond===seconds+1&&now-lastChange<2200;
    if(seconds>0&&lastSecond===null)beep(seconds);
    else if(sequential)beep(seconds);
    lastSecond=seconds;
    lastChange=now;
  }
  const observer=new MutationObserver(update);
  observer.observe(clock,{childList:true,characterData:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){lastSecond=null;lastChange=0}
    update();
  });
  window.addEventListener('pagehide',()=>{observer.disconnect();ctx?.close().catch(()=>{})},{once:true});
  window.DartArena61Countdown={refresh:update};
  update();
})();