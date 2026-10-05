(()=>{
  const HOME='./index.html?from=internal&v=20261006-authsmooth3';
  const goHome=()=>{location.href=HOME};

  const brand=document.querySelector('header .brand');
  if(brand&&brand.dataset.homeLinkReady!=='1'){
    brand.dataset.homeLinkReady='1';
    brand.setAttribute('role','link');
    brand.setAttribute('tabindex','0');
    brand.setAttribute('aria-label','Til hovedlobby');
    brand.setAttribute('title','Til hovedlobby');
    brand.style.cursor='pointer';
    brand.addEventListener('click',goHome);
    brand.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        goHome();
      }
    });
  }

  document.addEventListener('click',event=>{
    const control=event.target.closest?.('button,a');
    if(!control)return;
    const label=String(control.textContent||'').trim().toLowerCase();
    if(label!=='til hovedlobby'&&label!=='tilbake til lobby')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    goHome();
  },true);
})();
