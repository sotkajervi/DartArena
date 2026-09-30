(()=>{
  const syncBestLabel=()=>{
    const host=document.getElementById('myBest');
    if(!host)return;
    const first=[...host.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.nodeValue?.trim());
    if(first&&first.nodeValue.includes('Din beste:'))first.nodeValue=first.nodeValue.replace('Din beste:','Offisiell online-beste:');
    else if(!host.children.length&&host.textContent.includes('Din beste:'))host.textContent=host.textContent.replace('Din beste:','Offisiell online-beste:');
  };
  const syncMessage=()=>{
    const host=document.getElementById('gameMessage');
    if(!host)return;
    const text=host.textContent||'';
    if(text.startsWith('Lagret •'))host.textContent=`Treningsresultat ${text.toLowerCase()} • teller ikke på Top 10 eller JDC-tier`;
  };
  const observer=new MutationObserver(()=>{syncBestLabel();syncMessage()});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  syncBestLabel();syncMessage();
  window.addEventListener('pagehide',()=>observer.disconnect());
})();