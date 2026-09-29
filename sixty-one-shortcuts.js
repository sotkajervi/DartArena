(()=>{
  const hit=document.getElementById('hitBtn');
  const miss=document.getElementById('missBtn');
  const pause=document.getElementById('pauseBtn');
  const undo=document.getElementById('undoBtn');
  if(!hit||!miss)return;

  function canUse(button){
    return !!button&&!button.disabled&&button.getClientRects().length>0;
  }

  function isTypingTarget(target){
    if(!target)return false;
    const tag=target.tagName?.toLowerCase();
    return tag==='input'||tag==='textarea'||tag==='select'||target.isContentEditable;
  }

  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||isTypingTarget(event.target))return;

    let button=null;
    if(event.code==='Space')button=hit;
    else if(event.code==='Backspace')button=miss;
    else if(event.code==='KeyP')button=pause;
    else if(event.code==='KeyZ')button=undo;
    else return;

    // Prevent Space from scrolling and Backspace from navigating away from the game.
    event.preventDefault();
    if(canUse(button))button.click();
  });
})();
