(()=>{
  const brand=document.querySelector('header .brand');
  if(!brand||brand.dataset.homeLinkReady==='1')return;

  brand.dataset.homeLinkReady='1';
  brand.setAttribute('role','link');
  brand.setAttribute('tabindex','0');
  brand.setAttribute('aria-label','Til hovedlobby');
  brand.setAttribute('title','Til hovedlobby');
  brand.style.cursor='pointer';

  const goHome=()=>{location.href='./'};
  brand.addEventListener('click',goHome);
  brand.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      goHome();
    }
  });
})();
