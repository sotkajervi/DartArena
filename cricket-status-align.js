/* Cricket TV: fixed video and input dimensions define sidebar height.
   Kastlogg fills only the remaining space. Never derive sidebar height from
   input position: that causes runaway layout growth after submitted visits. */
(()=>{
  'use strict';
  const column=document.querySelector('.match-grid');
  const score=column?.querySelector('.score-card');
  const status=column?.querySelector('.match-info');
  const history=score?.querySelector('.cricket-history');
  const log=score?.querySelector('.cricket-history-list');
  const entry=document.querySelector('.cricket-entry-card');
  const dock=document.getElementById('focusInputDock');
  const view=document.getElementById('matchView');
  const video=document.getElementById('videoGrid');
  if(!column||!score||!status||!history||!log||!entry||!video||!view)return;

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
        width:100%!important;
        max-width:100%!important;
        align-self:stretch!important;
        box-sizing:border-box!important;
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
    // Do not measure the input's bottom: the score column can itself move that
    // grid row down, creating a feedback loop after visits are registered.
    // Instead use the independent heights of the fixed video and input dock.
    const ownTurn=document.body.classList.contains('own-turn-focus') &&
      getComputedStyle(entry).display!=='none';
    const videoHeight=video.getBoundingClientRect().height;
    const inputHeight=ownTurn?(dock||entry).getBoundingClientRect().height:0;
    const gap=parseFloat(getComputedStyle(view).rowGap)||0;
    const height=Math.ceil(videoHeight+(ownTurn?inputHeight+gap:0));
    if(!Number.isFinite(height)||height<=0)return;
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
  if(dock)resize.observe(dock);
  const mode=new MutationObserver(schedule);
  mode.observe(document.body,{attributes:true,attributeFilter:['class']});
  schedule();
})();