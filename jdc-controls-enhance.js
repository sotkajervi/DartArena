(()=>{
  const $=id=>document.getElementById(id);

  function ensureStyle(){
    if(document.getElementById('jdc-controls-enhance-style'))return;
    const style=document.createElement('style');
    style.id='jdc-controls-enhance-style';
    style.textContent=`
      .jdc-match-page .jdc-online-utility{
        display:grid!important;
        grid-template-columns:minmax(0,240px) minmax(0,240px)!important;
        gap:8px!important;
        align-items:stretch;
      }
      .jdc-match-page #undoBtn{
        background:#35171a!important;
        color:#ff9ba1!important;
        border-color:#743139!important;
      }
      .jdc-match-page #undoBtn:not(:disabled):hover{
        border-color:#ff6f78!important;
        box-shadow:inset 0 0 18px rgba(255,111,120,.10);
      }
      .jdc-match-page #confirmTurnBtn{
        background:#102d30!important;
        color:#00eaf4!important;
        border:1px solid #2b6d6c!important;
        border-radius:10px;
        font-weight:900;
        min-height:42px;
      }
      .jdc-match-page #confirmTurnBtn:not(:disabled):hover{
        border-color:var(--cyan)!important;
        box-shadow:inset 0 0 18px rgba(35,226,209,.12);
      }
      .jdc-match-page #confirmTurnBtn:disabled{opacity:.36!important;cursor:not-allowed}
      @media(max-width:620px){
        .jdc-match-page .jdc-online-utility{grid-template-columns:1fr 1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function sync(){
    const confirm=$('confirmTurnBtn');
    const shanghai=$('shanghaiActions');
    if(!confirm||!shanghai)return;
    const isShanghai=!shanghai.classList.contains('hidden');
    const actionButtons=[...shanghai.querySelectorAll('button')];
    const myTurn=actionButtons.some(b=>!b.disabled);
    const hasSelection=!!shanghai.querySelector('.jdc-selected');
    confirm.classList.toggle('hidden',!isShanghai);
    confirm.disabled=!isShanghai||!myTurn||!hasSelection;
  }

  function boot(){
    const utility=document.querySelector('.jdc-online-utility');
    const undo=$('undoBtn');
    if(!utility||!undo)return;
    ensureStyle();
    undo.classList.remove('outline');
    undo.classList.add('danger');

    let confirm=$('confirmTurnBtn');
    if(!confirm){
      confirm=document.createElement('button');
      confirm.id='confirmTurnBtn';
      confirm.type='button';
      confirm.innerHTML='Bekreft <span class="da-key">Enter</span>';
      utility.appendChild(confirm);
    }
    confirm.onclick=()=>{
      if(confirm.disabled)return;
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    };

    const observer=new MutationObserver(sync);
    observer.observe(document.querySelector('.jdc-play-card')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
    sync();
    window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
