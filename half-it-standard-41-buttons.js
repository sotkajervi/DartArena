(()=>{
  if(window.__dartArenaHalfItStandard41Buttons)return;
  window.__dartArenaHalfItStandard41Buttons=true;

  const style=document.createElement('style');
  style.textContent=`
    body.half-it-page .half-standard-41-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:2px}
    body.half-it-page .half-standard-41-actions button{min-height:76px;font-size:24px;font-weight:950;border-radius:16px}
    body.half-it-page .half-standard-41-hit{background:#123e31!important;border:1px solid #2e8a69!important;color:#73f2b4!important}
    body.half-it-page .half-standard-41-miss{background:#3a181c!important;border:1px solid #873841!important;color:#ff9fa7!important}
    body.half-it-page .half-standard-41-actions button:disabled{opacity:.42;cursor:not-allowed}
    body.half-it-page .half-standard-41-actions .da-key{margin-left:8px}
    @media(max-width:600px){body.half-it-page .half-standard-41-actions button{min-height:86px;font-size:23px}}
  `;
  document.head.appendChild(style);

  const originalBuildPad=buildPad;
  const originalRenderEntry=renderEntry;

  const isExact41=()=>currentRound()?.type==='exact'&&Number(currentRound()?.target)===41;

  async function submitExact41(hit){
    if(!canThrow()||submitting||!isExact41())return;

    // Backend still validates the official Standard Half-It rule.
    // A hit is represented by three legal, non-miss darts totalling exactly 41.
    selectedDarts=hit
      ?[{n:20,mult:1},{n:20,mult:1},{n:1,mult:1}]
      :[{n:0,mult:0},{n:0,mult:0},{n:0,mult:0}];

    await submitRound();
  }

  buildPad=function(){
    if(!isExact41())return originalBuildPad();

    const host=$('halfPad');
    if(!host)return;
    if(m?.status!=='playing'){
      host.innerHTML='';
      return;
    }

    const enabled=canThrow();
    host.innerHTML=`<div class="half-standard-41-actions">
      <button id="halfExact41Hit" class="half-standard-41-hit" type="button" ${enabled?'':'disabled'}>✓ TREFF <span class="da-key">SPACE</span></button>
      <button id="halfExact41Miss" class="half-standard-41-miss" type="button" ${enabled?'':'disabled'}>✕ BOM <span class="da-key">BACKSPACE</span></button>
    </div>`;

    const hit=$('halfExact41Hit'),miss=$('halfExact41Miss');
    if(hit)hit.onclick=()=>submitExact41(true);
    if(miss)miss.onclick=()=>submitExact41(false);
  };

  renderEntry=function(){
    if(!isExact41()){
      $('halfDarts')?.classList.remove('hidden');
      document.querySelector('.half-actions')?.classList.remove('hidden');
      return originalRenderEntry();
    }

    $('halfDarts')?.classList.add('hidden');
    document.querySelector('.half-actions')?.classList.add('hidden');
    const help=$('halfHelp');
    if(help)help.textContent='Fikk du nøyaktig 41 med tre tellende piler? Velg TREFF. Ellers velger du BOM.';
    buildPad();
  };

  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||!isExact41())return;
    const tag=event.target?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||event.target?.isContentEditable)return;

    if(event.code==='Space'){
      event.preventDefault();
      event.stopImmediatePropagation();
      $('halfExact41Hit')?.click();
    }else if(event.key==='Backspace'){
      event.preventDefault();
      event.stopImmediatePropagation();
      $('halfExact41Miss')?.click();
    }
  },true);
})();
