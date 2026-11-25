/* Presentation only. Existing opponent-focus owns PiP and the input dock.
   Existing Half-It engines still own all values, controls, and submissions. */
(()=>{
 const dock=document.getElementById('focusInputDock');
 const dialog=document.getElementById('halfResultsDialog');
 const open=document.getElementById('halfResultsButton');
 const close=document.getElementById('halfResultsClose');
 if(dock&&typeof ResizeObserver==='function'){
   const measure=()=>{
     const height=Math.ceil(dock.getBoundingClientRect().height);
     if(height>0)document.body.style.setProperty('--half-dock-height',(height+8)+'px');
   };
   const observer=new ResizeObserver(measure);
   observer.observe(dock);
   window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
   measure();
 }
 if(dialog&&open&&close){
   open.onclick=()=>{if(!dialog.open)dialog.showModal()};
   close.onclick=()=>dialog.close();
   dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close()}});
   // Do not send scoring shortcuts while the result list is open.
   window.addEventListener('keydown',event=>{if(dialog.open&&event.key!=='Escape')event.stopImmediatePropagation()},true);
 }
})();
