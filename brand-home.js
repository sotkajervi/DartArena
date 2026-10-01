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

  function loadScript(src,key){
    if(document.querySelector(`script[data-dartarena-${key}]`))return;
    const script=document.createElement('script');script.src=src;script.dataset[`dartarena${key[0].toUpperCase()+key.slice(1)}`]='1';document.body.appendChild(script);
  }

  const needsReconnect=()=>!!document.querySelector('#remoteVideo,#spectateVideo2,#p2Video');
  if(needsReconnect())loadScript('reconnect-status.js?v=20261001-reconnect1','reconnect');
  if(window.supabase){
    loadScript('owner-ui-gates.js?v=20261001-owner1','ownergates');
    loadScript('client-error-log.js?v=20261001-errors1','errorlog');
  }
  if(document.getElementById('lobbyView')&&window.supabase){
    loadScript('admin-active-cleanup.js?v=20261001-cleanup1','cleanup');
    loadScript('admin-error-log.js?v=20261001-errors1','adminerrorlog');
  }
  if(location.pathname.endsWith('/match-history.html')||location.pathname.endsWith('match-history.html'))loadScript('match-history-export.js?v=20261001-csv1','historyexport');
})();
