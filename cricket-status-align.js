/* Cricket TV: use the free space for the visit log so the status/camera
   panel ends level with the video (opponent turn) or input dock (own turn).
   Only Cricket; neither media elements nor scoring logic are changed. */
(()=>{
  'use strict';
  const column=document.querySelector('.match-grid');
  const score=column?.querySelector('.score-card');
  const status=column?.querySelector('.match-info');
  const history=score?.querySelector('.cricket-history');
  const log=score?.querySelector('.cricket-history-list');
  const entry=document.querySelector('.cricket-entry-card');
  const video=document.getElementById('videoGrid');
  if(!column||!score||!status||!history||!log||!entry||!video)return;

  const style=document.createElement('style');
  style.id='da-cricket-status-align-style';
  style.textContent=`
    @media(min-width:801px){
      body.match-page.cricket-tv-layout .match-grid{
        display:flex!important;
        flex-direction:column!important;
        height:var(--da-cricket-column-height)!important;
        min-height:0!important;
        max-height:none!important;
        overflow:hidden!important;
        scrollbar-width:none!important;
      }
      body.match-page.cricket-tv-layout .match-grid>.score-card{
        display:flex!important;
        flex-direction:column!important;
        flex:1 1 auto!important;
        min-height:0!important;
      }
      body.match-page.cricket-tv-layout .score-card>.cricket-play-grid{
        flex:0 0 auto!important;
      }
      body.match-page.cricket-tv-layout .score-card>.cricket-history{
        display:flex!important;
        flex-direction:column!important;
        flex:1 1 auto!important;
        min-height:40px!important;
        overflow:hidden!important;
      }
      body.match-page.cricket-tv-layout .cricket-history-list{
        flex:1 1 auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
      }
      body.match-page.cricket-tv-layout .match-grid>.match-info{
        flex:0 0 auto!important;
        min-height:0!important;
      }
    }
  `;
  document.head.appendChild(style);

  let frame=0,lastHeight=0;
  function align(){
    frame=0;
    const active=window.innerWidth>=801 &&
      document.body.classList.contains('cricket-tv-layout');
    if(!active){
      column.style.removeProperty('--da-cricket-column-height');
      lastHeight=0;
      return;
    }
    const ownTurn=document.body.classList.contains('own-turn-focus') &&
      getComputedStyle(entry).display!=='none';
    const bottom=(ownTurn?entry:video).getBoundingClientRect().bottom;
    const start=column.getBoundingClientRect().top;
    if(!Number.isFinite(bottom)||!Number.isFinite(start)||bottom<=start)return;
    const height=Math.ceil(bottom-start);
    if(height!==lastHeight){
      column.style.setProperty('--da-cricket-column-height',height+'px');
      lastHeight=height;
    }
  }
  function schedule(){
    if(!frame)frame=requestAnimationFrame(align);
  }

  window.addEventListener('resize',schedule,{passive:true});
  const resize=new ResizeObserver(schedule);
  resize.observe(video);
  resize.observe(entry);
  const mode=new MutationObserver(schedule);
  mode.observe(document.body,{attributes:true,attributeFilter:['class']});
  schedule();
})();