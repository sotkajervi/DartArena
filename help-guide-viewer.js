/* Scrollable, keyboard-accessible full-window Zoom-cam guide. */
(()=>{
  'use strict';
  const open=document.getElementById('helpZoomcamOpen');
  const dialog=document.getElementById('helpZoomcamViewer');
  const viewport=document.getElementById('helpZoomcamViewport');
  const picture=document.getElementById('helpZoomcamFull');
  const scaleOutput=document.getElementById('helpZoomcamScale');
  const plus=document.getElementById('helpZoomcamIn');
  const minus=document.getElementById('helpZoomcamOut');
  const fit=document.getElementById('helpZoomcamFit');
  const close=document.getElementById('helpZoomcamClose');
  if(!open||!dialog||!viewport||!picture||!scaleOutput||!plus||!minus||!fit||!close)return;
  let baseWidth=1100,scale=100;
  function drawWidth(nextScale){
    const previousWidth=picture.getBoundingClientRect().width||baseWidth;
    const x=(viewport.scrollLeft+viewport.clientWidth/2)/previousWidth;
    const y=(viewport.scrollTop+viewport.clientHeight/2)/(previousWidth*855/650);
    scale=Math.min(250,Math.max(50,nextScale));
    const width=Math.round(baseWidth*scale/100);
    picture.style.width=width+'px';
    scaleOutput.value=scale+' %';
    scaleOutput.textContent=scale+' %';
    // Preserve approximate viewport center when zooming.
    viewport.scrollLeft=x*width-viewport.clientWidth/2;
    viewport.scrollTop=y*(width*855/650)-viewport.clientHeight/2;
  }
  open.addEventListener('click',event=>{
    if(typeof dialog.showModal!=='function')return; // Regular image link remains a fallback.
    event.preventDefault();
    if(dialog.open)return;
    dialog.showModal();
    // Large by default: readers scroll vertically through all four panels.
    // On mobile the image may be scrolled horizontally as well.
    baseWidth=Math.max(850,Math.min(1350,viewport.clientWidth-24));
    scale=100;
    picture.style.width=Math.round(baseWidth)+'px';
    scaleOutput.value='100 %';
    scaleOutput.textContent='100 %';
    viewport.scrollTop=0;
    viewport.scrollLeft=0;
    close.focus();
  });
  plus.addEventListener('click',()=>drawWidth(scale+25));
  minus.addEventListener('click',()=>drawWidth(scale-25));
  fit.addEventListener('click',()=>{
    baseWidth=Math.max(1,viewport.clientWidth-24);
    scale=100;
    picture.style.width=baseWidth+'px';
    scaleOutput.value='100 %';
    scaleOutput.textContent='100 %';
    viewport.scrollTop=0;
    viewport.scrollLeft=0;
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });
  dialog.addEventListener('close',()=>open.focus());
})();
