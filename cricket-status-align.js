/* Align desktop Cricket status panel with the bottom of DITT KAST.
   No effect on mobile or X01; keep natural heights in TV handoff layout. */
(()=>{
  const status=document.querySelector('.match-grid > .match-info');
  const entry=document.querySelector('.cricket-entry-card');
  if(!status||!entry)return;
  let scheduled=false;
  function align(){
    scheduled=false;
    if(window.innerWidth<1050||document.body.classList.contains('match-tv-layout')){
      status.style.removeProperty('min-height');
      return;
    }
    const start=status.getBoundingClientRect().top;
    const end=entry.getBoundingClientRect().bottom;
    // Match the real bottom edge; do not shrink the content if panels overlap.
    const contentHeight=status.scrollHeight;
    const target=Math.max(contentHeight,Math.round(end-start));
    status.style.minHeight=target+'px';
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(align);
  }
  window.addEventListener('resize',schedule,{passive:true});
  const observer=new ResizeObserver(schedule);
  observer.observe(entry);
  observer.observe(document.querySelector('#videoGrid')||entry);
  schedule();
})();
