(()=>{
  const hit=document.getElementById('hitBtn');
  const miss=document.getElementById('missBtn');
  if(!hit||!miss)return;

  function canUse(button){
    return !button.disabled&&button.getClientRects().length>0;
  }

  function isTypingTarget(target){
    if(!target)return false;
    const tag=target.tagName?.toLowerCase();
    return tag==='input'||tag==='textarea'||tag==='select'||target.isContentEditable;
  }

  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||isTypingTarget(event.target))return;

    if(event.code==='Space'){
      if(!canUse(hit))return;
      event.preventDefault();
      hit.click();
      return;
    }

    if(event.key?.toLowerCase()==='b'){
      if(!canUse(miss))return;
      event.preventDefault();
      miss.click();
    }
  });
})();
