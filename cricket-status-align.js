/* Match Kampstatus bottom to DITT KAST in Cricket's own-turn TV layout.
   The camera frame and X01 are deliberately untouched. */
(()=>{
  const status=document.querySelector('.match-grid > .match-info');
  const entry=document.querySelector('.cricket-entry-card');
  const score=document.querySelector('.match-grid');
  if(!status||!entry||!score)return;

  // The own-turn Cricket entry is docked under video, not inside the score card.
  // It extends lower than the default TV score-column height.
  const style=document.createElement('style');
  style.id='da-cricket-status-align-style';
  style.textContent=`
    @media (min-width: 801px){
      body.match-page.cricket-tv-layout.own-turn-focus .match-grid{
        max-height:none!important;
        overflow:visible!important;
      }
    }
  `;
  document.head.appendChild(style);

  let frame=0;
  function align(){
    frame=0;
    const visible=window.innerWidth>=801 &&
      document.body.classList.contains('cricket-tv-layout') &&
      document.body.classList.contains('own-turn-focus') &&
      getComputedStyle(entry).display!=='none';
    if(!visible){
      status.style.removeProperty('min-height');
      return;
    }

    // Measure the natural status size first; otherwise an old min-height can
    // make the panel grow cumulatively as the layout changes.
    status.style.removeProperty('min-height');
    const start=status.getBoundingClientRect().top;
    const end=entry.getBoundingClientRect().bottom;
    const natural=status.getBoundingClientRect().height;
    if(!Number.isFinite(start)||!Number.isFinite(end))return;
    const height=Math.max(natural,Math.ceil(end-start));
    status.style.minHeight=height+'px';
  }
  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(align);
  }

  window.addEventListener('resize',schedule,{passive:true});
  const observer=new ResizeObserver(schedule);
  observer.observe(entry);
  observer.observe(score);
  const states=new MutationObserver(schedule);
  states.observe(document.body,{attributes:true,attributeFilter:['class']});
  schedule();
})();
