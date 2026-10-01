(()=>{
  const brand=document.querySelector('header .brand');
  if(brand&&brand.dataset.homeLinkReady!=='1'){
    brand.dataset.homeLinkReady='1';
    brand.setAttribute('role','link');
    brand.setAttribute('tabindex','0');
    brand.setAttribute('aria-label','Til hovedlobby');
    brand.setAttribute('title','Til hovedlobby');
    brand.style.cursor='pointer';
    const goHome=()=>{location.href='./'};
    brand.addEventListener('click',goHome);
    brand.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();goHome()}
    });
  }

  const needsReconnect=()=>!!document.querySelector('#remoteVideo,#spectateVideo2,#p2Video');
  if(needsReconnect()&&!document.querySelector('script[data-dartarena-reconnect]')){
    const script=document.createElement('script');
    script.src='reconnect-status.js?v=20261001-reconnect1';
    script.dataset.dartarenaReconnect='1';
    document.body.appendChild(script);
  }
})();
