(()=>{
  if(window.__dartArenaUiFeedback)return;
  window.__dartArenaUiFeedback=true;

  const clickMap={
    availabilityBtn:['Lagrer…',900],
    reopenMatchBtn:['Åpner…',650],
    joinBtn:['Melder på…',1000],
    leaveBtn:['Melder av…',1000],
    proposalBtn:['Sender…',900],
    retryCameraBtn:['Starter kamera…',1400],
    cameraBtn:['Starter kamera…',1400],
    readyBtn:['Klargjør…',1000],
    buildCupBtn:['Oppretter…',1800],
    matchScoreBtn:['Registrerer…',500],
    cricketSubmitBtn:['Registrerer…',500]
  };

  function setBusy(button,label,ms){
    if(!button||button.classList.contains('ui-busy')||button.disabled)return;
    const original=button.textContent;
    button.classList.add('ui-busy');
    button.setAttribute('aria-busy','true');
    button.setAttribute('aria-disabled','true');
    button.textContent=label;
    window.setTimeout(()=>{
      if(!button.isConnected)return;
      if(button.textContent===label)button.textContent=original;
      button.classList.remove('ui-busy');
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
    },ms);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(button?.classList.contains('ui-busy')){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    const spec=button&&clickMap[button.id];
    if(!spec)return;
    setTimeout(()=>setBusy(button,spec[0],spec[1]),0);
  });

  document.addEventListener('submit',event=>{
    const form=event.target;
    let button=event.submitter;
    if(!button)button=form.querySelector('button[type="submit"],input[type="submit"]');
    if(!button)return;
    let label=null,ms=1400;
    if(form.id==='authForm')label=button.textContent.includes('Opprett')?'Oppretter…':'Logger inn…';
    else if(form.id==='createTournamentForm'){label='Oppretter…';ms=1600;}
    if(label)setTimeout(()=>setBusy(button,label,ms),0);
  });
})();
