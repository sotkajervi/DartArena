(()=>{
  const isTypingTarget=target=>{
    const tag=target?.tagName;
    return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||target?.isContentEditable;
  };

  const visible=el=>!!el&&el.getClientRects().length>0;
  const usable=el=>visible(el)&&!el.disabled;
  const firstUsable=idList=>idList.map(id=>document.getElementById(id)).find(usable)||null;

  function ensureKey(button,key){
    if(!button||button.querySelector('.da-key'))return;
    const badge=document.createElement('span');
    badge.className='da-key';
    badge.textContent=key;
    button.appendChild(badge);
  }

  function decorate(){
    const miss=firstUsable(['halfMissBtn','soloMissBtn'])||document.getElementById('halfMissBtn')||document.getElementById('soloMissBtn');
    const undo=document.getElementById('halfUndoBtn')||document.getElementById('soloUndoBtn');
    const submit=document.getElementById('halfSubmitBtn')||document.getElementById('soloSubmitBtn');
    ensureKey(miss,'0');
    ensureKey(undo,'Backspace');
    ensureKey(submit,'Enter');

    document.querySelectorAll('.half-quick').forEach(group=>{
      [...group.querySelectorAll('button.half-hit')].slice(0,3).forEach((button,index)=>ensureKey(button,String(index+1)));
    });
    document.querySelectorAll('.half-multiplier').forEach(group=>{
      [...group.querySelectorAll('button.half-mult')].slice(0,3).forEach((button,index)=>ensureKey(button,String(index+1)));
    });
    document.querySelectorAll('.half-exact-options').forEach(group=>{
      [...group.querySelectorAll('button.half-exact-option')].slice(0,3).forEach((button,index)=>ensureKey(button,String(index+1)));
    });
    const soloExact=document.getElementById('exactChoiceWrap');
    if(soloExact){
      [...soloExact.querySelectorAll('button')].slice(0,3).forEach((button,index)=>ensureKey(button,String(index+1)));
    }
  }

  function clickButton(button,event){
    if(!usable(button))return false;
    event.preventDefault();
    button.click();
    button.blur?.();
    return true;
  }

  function numberedChoice(index,event){
    const groups=[
      '.half-exact-options',
      '#exactChoiceWrap:not(.hidden)',
      '.half-quick',
      '.half-multiplier'
    ];
    for(const selector of groups){
      const group=[...document.querySelectorAll(selector)].find(visible);
      if(!group)continue;
      const buttons=[...group.querySelectorAll('button')].filter(visible);
      const button=buttons[index];
      if(clickButton(button,event))return true;
    }
    return false;
  }

  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||isTypingTarget(event.target))return;

    if(event.key==='0'){
      clickButton(firstUsable(['halfMissBtn','soloMissBtn']),event);
      return;
    }
    if(event.key==='Backspace'){
      clickButton(firstUsable(['halfUndoBtn','soloUndoBtn']),event);
      return;
    }
    if(event.key==='Enter'){
      clickButton(firstUsable(['halfSubmitBtn','soloSubmitBtn']),event);
      return;
    }
    if(event.key==='1'||event.key==='2'||event.key==='3')numberedChoice(Number(event.key)-1,event);
  });

  const observer=new MutationObserver(decorate);
  observer.observe(document.body,{childList:true,subtree:true});
  decorate();
})();
