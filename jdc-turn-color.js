(()=>{
  const el=document.getElementById('turnText');
  if(!el)return;

  function render(){
    const text=el.textContent.trim();
    const match=text.match(/^(.*?)(\s+(?:kaster|vant))$/);
    if(!match){
      if(el.querySelector('.jdc-turn-player'))el.textContent=text;
      return;
    }
    const name=match[1];
    const suffix=match[2];
    const existing=el.querySelector('.jdc-turn-player');
    if(existing&&existing.textContent===name&&el.textContent===text)return;
    el.replaceChildren();
    const span=document.createElement('span');
    span.className='jdc-turn-player';
    span.textContent=name;
    span.style.color='var(--cyan)';
    el.append(span,document.createTextNode(suffix));
  }

  const observer=new MutationObserver(()=>render());
  observer.observe(el,{childList:true,characterData:true,subtree:true});
  render();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
