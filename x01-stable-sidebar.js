/* X01 desktop: keep the left panel stationary while video and score input
   change on turn switches. Viewport and actual panel top define available
   height; never derive it from the turn-dependent video or input. */
(()=>{
  'use strict';
  if(window.DartArenaX01StableSidebar)return;
  const state={height:0,turn:'',enabled:false};
  const grid=document.querySelector('#matchView .match-grid');
  const status=grid?.querySelector('.match-info');
  const score=grid?.querySelector('.score-card');
  if(!grid||!status||!score)return;
  let frame=0;
  const desktop=()=>window.innerWidth>=801 &&
    document.body.classList.contains('match-page') &&
    document.body.classList.contains('standard-tv-layout') &&
    !document.getElementById('cricketBoard');
  function measure(){
    frame=0;
    if(!desktop()){
      for(const p of ['height','min-height','max-height','display','flex-direction','overflow','align-self'])grid.style.removeProperty(p);
      for(const p of ['display','flex-direction','flex','min-height'])status.style.removeProperty(p);
      score.style.removeProperty('flex');
      state.enabled=false;
      return;
    }
    const top=grid.getBoundingClientRect().top;
    if(!Number.isFinite(top)||top<=0)return;
    // Allow 24px of breathing room below the live match frame. This is the
    // same on both turns and adapts to the actual header and viewport.
    const available=Math.max(260,Math.floor(window.innerHeight-top-24));
    if(state.height!==available||!state.enabled){
      grid.style.setProperty('display','flex','important');
      grid.style.setProperty('flex-direction','column','important');
      grid.style.setProperty('align-self','start','important');
      grid.style.setProperty('height',available+'px','important');
      grid.style.setProperty('min-height','0','important');
      grid.style.setProperty('max-height',available+'px','important');
      grid.style.setProperty('overflow','hidden','important');
      score.style.setProperty('flex','0 0 auto','important');
      status.style.setProperty('display','flex','important');
      status.style.setProperty('flex-direction','column','important');
      status.style.setProperty('flex','1 1 auto','important');
      status.style.setProperty('min-height','0','important');
      state.height=available;
      state.enabled=true;
    }
    const next=document.body.classList.contains('opponent-focus')?'opponent':'own';
    if(state.turn!==next){
      state.turn=next;
      console.debug('[X01 SIDEBAR]',{turn:next,panelHeight:available,viewportHeight:window.innerHeight});
    }
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(measure)}
  window.addEventListener('resize',schedule,{passive:true});
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  window.DartArenaX01StableSidebar={measure:schedule,metrics:()=>({...state})};
  schedule();
})();