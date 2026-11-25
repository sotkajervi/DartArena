/* Presentation only. Existing opponent-focus owns PiP and the input dock.
   Existing Half-It engines still own all values, controls, and submissions. */
(()=>{
 // Half-It stores the CURRENT leg starter in match_starter_id (unlike X01).
 function renderStarter(match){
   const starter=match?.status==='playing'?match.match_starter_id:null;
   const factory=window.DartArenaLegStarterMarkerUI?.create;
   for(const [id,player] of [['halfName1',match?.player1_id],['halfName2',match?.player2_id]]){
     const host=document.getElementById(id);if(!host)continue;
     const existing=host.querySelector('.da-leg-starter-dart');
     if(!starter||starter!==player)existing?.remove();
     else if(!existing&&factory)host.appendChild(factory());
   }
 }
 window.DartArenaHalfItStarter=Object.freeze({render:renderStarter});
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
