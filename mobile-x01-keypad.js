/* Online X01: touch keypad only under 701 CSS pixels. Desktop remains unchanged. */
(()=>{
  'use strict';
  if(!document.body.classList.contains('match-page')||document.getElementById('cricketBoard'))return;
  const media=window.matchMedia('(max-width: 700px)');
  const input=document.getElementById('matchScoreInput');
  const button=document.getElementById('matchScoreBtn');
  const entry=document.querySelector('.score-entry');
  if(!input||!button||!entry)return;
  let keypad=null,watch=null,saved=null;
  function syncDisabled(){
    if(!keypad)return;
    const off=input.disabled||button.disabled;
    keypad.querySelectorAll('button').forEach(b=>{b.disabled=off});
  }
  function activate(){
    if(keypad)return;
    saved={readOnly:input.readOnly,inputmode:input.getAttribute('inputmode')};
    input.readOnly=true;
    input.setAttribute('inputmode','none');
    input.setAttribute('aria-label','Score – bruk talltastaturet nedenfor');
    if(document.activeElement===input)input.blur();
    keypad=document.createElement('div');
    keypad.className='da-mobile-x01-pad';
    keypad.setAttribute('role','group');
    keypad.setAttribute('aria-label','Talltastatur for score');
    const keys=[1,2,3,4,5,6,7,8,9,'delete',0,'enter'];
    keys.forEach(key=>{
      const b=document.createElement('button');
      b.type='button';
      if(typeof key==='number'){
        b.textContent=String(key);
        b.dataset.digit=String(key);
        b.setAttribute('aria-label',String(key));
      }else{
        b.dataset.action=key;
        b.textContent=key==='delete'?'⌫':'Enter';
        b.setAttribute('aria-label',key==='delete'?'Slett siste siffer':'Registrer score');
      }
      keypad.appendChild(b);
    });
    entry.insertAdjacentElement('afterend',keypad);
    keypad.addEventListener('click',ev=>{
      const key=ev.target.closest('button');
      if(!key||input.disabled||button.disabled)return;
      const digit=key.dataset.digit;
      const action=key.dataset.action;
      if(digit!==undefined){
        if(input.value.length>=3)return;
        input.value+=digit;
      }else if(action==='delete'){
        input.value=input.value.slice(0,-1);
      }else if(action==='enter'){
        button.click();
      }
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    watch=new MutationObserver(syncDisabled);
    watch.observe(input,{attributes:true,attributeFilter:['disabled']});
    watch.observe(button,{attributes:true,attributeFilter:['disabled']});
    syncDisabled();
  }
  function deactivate(){
    watch?.disconnect();watch=null;
    keypad?.remove();keypad=null;
    if(saved){
      input.readOnly=saved.readOnly;
      if(saved.inputmode===null)input.removeAttribute('inputmode');
      else input.setAttribute('inputmode',saved.inputmode);
      input.setAttribute('aria-label','Score 0–180');
      saved=null;
    }
  }
  function sync(){if(media.matches)activate();else deactivate()}
  media.addEventListener('change',sync);
  sync();
  window.addEventListener('pagehide',()=>{deactivate();media.removeEventListener('change',sync)},{once:true});
})();