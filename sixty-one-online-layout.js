/* Presentation adapter only, shared X01 opponent-focus owns the video nodes. */
(()=>{
 const $=id=>document.getElementById(id),dock=$('focusInputDock'),dialog=$('sixtyOneHistoryDialog');
 if(dock&&typeof ResizeObserver==='function'){
  const measure=()=>{const height=Math.ceil(dock.getBoundingClientRect().height);if(height>0)document.body.style.setProperty('--sixty-one-dock-height',(height+8)+'px')};
  const observer=new ResizeObserver(measure);observer.observe(dock);measure();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 }
 if(dialog){
  $('sixtyOneHistoryButton').onclick=()=>{if(!dialog.open)dialog.showModal()};
  $('sixtyOneHistoryClose').onclick=()=>dialog.close();
  window.addEventListener('keydown',e=>{if(!dialog.open||e.key==='Escape')return;if(['Enter','0','2','Backspace','p','P','z','Z'].includes(e.key)||['Numpad0','Numpad2','NumpadEnter'].includes(e.code))e.preventDefault();e.stopImmediatePropagation()},true);
 }
})();
