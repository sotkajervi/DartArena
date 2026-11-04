/* Cricket TV layout: align the status/local camera panel with the right column.
   As visits accumulate, scroll only the visit log, never the entire left column.
   X01 and the video/camera elements are not modified. */
(()=>{
  const score=document.querySelector('.match-grid');
  const status=score?.querySelector('.match-info');
  const history=score?.querySelector('.cricket-history-list');
  const entry=document.querySelector('.cricket-entry-card');
  const video=document.getElementById('videoGrid');
  if(!score||!status||!history||!entry||!video)return;

  const style=document.createElement('style');
  style.id='da-cricket-status-align-style';
  style.textContent=`
    @media(min-width:801px){
      body.match-page.cricket-tv-layout .match-grid{
        max-height:none!important;
        overflow:visible!important;
        scrollbar-width:none!important;
      }
    }
  `;
  document.head.appendChild(style);

  let frame=0,observed=false;
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(align)};
  function align(){
    frame=0;
    const active=window.innerWidth>=801 &&
      document.body.classList.contains('cricket-tv-layout');
    status.style.removeProperty('min-height');
    history.style.removeProperty('max-height');
    if(!active)return;

    const inputVisible=document.body.classList.contains('own-turn-focus') &&
      getComputedStyle(entry).display!=='none';
    const target=inputVisible?entry:video;
    const bottom=target.getBoundingClientRect().bottom;
    const scoreBottom=score.getBoundingClientRect().bottom;
    if(!Number.isFinite(bottom)||!Number.isFinite(scoreBottom))return;

    // Reclaim only the excess height from the log, preserving one visible row.
    const excess=Math.max(0,Math.ceil(scoreBottom-bottom));
    if(excess>0){
      const logHeight=history.getBoundingClientRect().height;
      const remaining=Math.max(32,Math.floor(logHeight-excess-2));
      if(logHeight>remaining+1)history.style.setProperty('max-height',remaining+'px','important');
    }

    // Grow the status card only when the left column ends above the right.
    const after=score.getBoundingClientRect().bottom;
    const gap=Math.floor(bottom-after);
    if(gap>1){
      const current=status.getBoundingClientRect().height;
      status.style.minHeight=Math.ceil(current+gap)+'px';
    }
  }

  window.addEventListener('resize',schedule,{passive:true});
  const observer=new ResizeObserver(schedule);
  observer.observe(video);
  observer.observe(entry);
  observer.observe(score);
  observer.observe(history);
  const bodyObserver=new MutationObserver(schedule);
  bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  schedule();
})();