/* Pentathlon 2P – fully local; no Supabase, camera or online match mutations. */
(function() {
  'use strict';
  const E=window.DartArenaPentathlon;
  if(!E)return;
  const $=id=>document.getElementById(id);
  const STORE='dartarena-pentathlon-local-2p-v1';
  let state=null,mult=1,feedback='Klar for første kast.';
  const SHANGHAI_QUEUE_KEY=STORE+':shanghai-pending';
  let shanghaiQueue=[];
  function queueIdentity(){
    if(!state||state.status!=='playing'||state.current.kind!=='shanghai')return null;
    return [state.createdAt,state.stageIndex,state.current.turn,state.current.entries.length].join(':');
  }
  function saveShanghaiQueue(){
    try{
      const signature=queueIdentity();
      if(signature&&shanghaiQueue.length)localStorage.setItem(SHANGHAI_QUEUE_KEY,JSON.stringify({signature,darts:shanghaiQueue}));
      else localStorage.removeItem(SHANGHAI_QUEUE_KEY);
    }catch(_){}
  }
  function restoreShanghaiQueue(){
    shanghaiQueue=[];
    try{
      const data=JSON.parse(localStorage.getItem(SHANGHAI_QUEUE_KEY)||'null');
      if(queueIdentity()&&data?.signature===queueIdentity()&&Array.isArray(data.darts)&&data.darts.length<=3&&data.darts.every(E.isDart)){
        shanghaiQueue=data.darts;
      }else localStorage.removeItem(SHANGHAI_QUEUE_KEY);
    }catch(_){}
  }
  function shanghaiQueueHit(n,m){
    if(state?.status!=='playing'||state.current.kind!=='shanghai'||shanghaiQueue.length>=3-state.current.pending.length)return;
    const dart={n,m};
    if(!E.isDart(dart))return;
    shanghaiQueue.push(dart);
    saveShanghaiQueue();
    render();
  }
  function shanghaiRemoveHit(){
    if(state?.status!=='playing'||state.current.kind!=='shanghai'||!shanghaiQueue.length)return;
    shanghaiQueue.pop();saveShanghaiQueue();render();
  }
  function shanghaiSubmitTurn(){
    if(state?.status!=='playing'||state.current.kind!=='shanghai')return;
    if(shanghaiQueue.length!==3-state.current.pending.length){
      $('pentaShanghaiMessage').textContent='Registrer alle tre pilene før Enter.';
      return;
    }
    try{
      const target=E.currentTarget(state);
      const who=state.current.turn;
      const darts=[...shanghaiQueue];
      let next=state;
      for(const dart of darts)next=E.submitDart(next,dart);
      state=next;
      shanghaiQueue=[];saveShanghaiQueue();
      feedback=state.players[who]+': '+darts.map(E.labelDart).join(' · ')+' på '+target.label+'.';
      persist();render();
      if(state.status==='review')$('pentaReviewPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(error){report(error)}
  }

  // Clock is confirmed per turn, as in local JDC. Pending hits never alter
  // official Pentathlon state until Enter; targets are previewed in sequence.
  const CLOCK_QUEUE_KEY=STORE+':clock-pending';
  let clockQueue=[];
  function clockIdentity(){
    if(state?.status!=='playing'||state.current.kind!=='clock')return null;
    return [state.createdAt,state.stageIndex,state.current.turn,state.current.entries.length].join(':');
  }
  function saveClockQueue(){
    try{
      const signature=clockIdentity();
      if(signature&&clockQueue.length)localStorage.setItem(CLOCK_QUEUE_KEY,JSON.stringify({signature,darts:clockQueue}));
      else localStorage.removeItem(CLOCK_QUEUE_KEY);
    }catch(_){}
  }
  function restoreClockQueue(){
    clockQueue=[];
    try{
      const data=JSON.parse(localStorage.getItem(CLOCK_QUEUE_KEY)||'null');
      if(clockIdentity()&&data?.signature===clockIdentity()&&Array.isArray(data.darts)&&data.darts.length<=3&&data.darts.every(E.isDart)){
        clockQueue=data.darts;
      }else localStorage.removeItem(CLOCK_QUEUE_KEY);
    }catch(_){}
  }
  function clockPreviewTarget(){
    const c=state.current,p=c.turn;
    let n=c.clockTarget[p];
    for(const dart of clockQueue)if(dart.n===n&&dart.m===2)n++;
    return n;
  }
  function clockQueueHit(hit){
    if(state?.status!=='playing'||state.current.kind!=='clock')return;
    const c=state.current,n=clockPreviewTarget(),remaining=42-c.used[c.turn]-clockQueue.length;
    if(n>20||clockQueue.length>=3-c.pending.length||remaining<=0)return;
    clockQueue.push(hit?{n,m:2}:{n:0,m:0});
    $('pentaClockMessage').classList.remove('is-error');
    saveClockQueue();render();
  }
  function clockRemoveHit(){
    if(state?.status!=='playing'||state.current.kind!=='clock'||!clockQueue.length)return;
    clockQueue.pop();$('pentaClockMessage').classList.remove('is-error');saveClockQueue();render();
  }
  function clockSubmitTurn(){
    if(state?.status!=='playing'||state.current.kind!=='clock')return;
    const c=state.current,p=c.turn;
    const completed=clockPreviewTarget()>20;
    const expected=Math.min(3-c.pending.length,42-c.used[p]);
    if(!completed&&clockQueue.length!==expected){
      $('pentaClockMessage').textContent='Registrer alle '+expected+' pilene før Enter.';
      $('pentaClockMessage').classList.add('is-error');
      return;
    }
    if(!clockQueue.length)return;
    try{
      let next=state;
      for(const dart of clockQueue){
        if(next.status!=='playing')break;
        next=E.submitDart(next,dart);
      }
      state=next;clockQueue=[];saveClockQueue();
      feedback=state.players[p]+': klokka er oppdatert.';
      persist();render();
      if(state.status==='review')$('pentaReviewPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(error){report(error)}
  }

  // Local Half-It entry: collect up to three darts, Enter completes the visit.
  // Unused darts are misses, matching local Half-It keyboard flow.
  const HALF_QUEUE_KEY=STORE+':half-pending';
  const HALF_TARGETS=[
    {n:20,m:0,label:'20'},{n:16,m:0,label:'16'},
    {n:7,m:2,label:'D7'},{n:14,m:0,label:'14'},
    {n:10,m:3,label:'T10'},{n:17,m:0,label:'17'},
    {n:25,m:2,label:'Bull 50'}
  ];
  let halfQueue=[];
  function halfIdentity(){
    if(state?.status!=='playing'||state.current.kind!=='half')return null;
    return [state.createdAt,state.stageIndex,state.current.turn,state.current.entries.length].join(':');
  }
  function saveHalfQueue(){
    try{
      const signature=halfIdentity();
      if(signature&&halfQueue.length)localStorage.setItem(HALF_QUEUE_KEY,JSON.stringify({signature,darts:halfQueue}));
      else localStorage.removeItem(HALF_QUEUE_KEY);
    }catch(_){}
  }
  function restoreHalfQueue(){
    halfQueue=[];
    try{
      const data=JSON.parse(localStorage.getItem(HALF_QUEUE_KEY)||'null');
      if(halfIdentity()&&data?.signature===halfIdentity()&&Array.isArray(data.darts)&&
        data.darts.length<=3&&data.darts.every(E.isDart))halfQueue=data.darts;
      else localStorage.removeItem(HALF_QUEUE_KEY);
    }catch(_){}
  }
  function halfAdd(n,m){
    if(state?.status!=='playing'||state.current.kind!=='half')return;
    if(halfQueue.length>=3-state.current.pending.length)return;
    const dart={n,m};if(!E.isDart(dart))return;
    halfQueue.push(dart);saveHalfQueue();render();
  }
  function halfRemove(){
    if(state?.status!=='playing'||state.current.kind!=='half'||!halfQueue.length)return;
    halfQueue.pop();saveHalfQueue();render();
  }
  function halfSubmit(){
    if(state?.status!=='playing'||state.current.kind!=='half')return;
    const existing=state.current.pending.length;
    const darts=[...halfQueue];
    while(darts.length<3-existing)darts.push({n:0,m:0});
    if(!darts.length)return;
    try{
      const player=state.current.turn,rule=E.currentTarget(state)?.label;
      let next=state;
      for(const dart of darts)next=E.submitDart(next,dart);
      state=next;halfQueue=[];saveHalfQueue();
      feedback=state.players[player]+': '+darts.map(E.labelDart).join(' · ')+' mot '+rule+'.';
      persist();render();
      if(state.status==='review')$('pentaReviewPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(error){report(error)}
  }
  let starting=false;
  let statsOpen=false;
  function setStatsOpen(open){
    statsOpen=Boolean(open&&state?.status==='playing'&&state.current?.kind==='x01');
    $('pentaStatsOpen').setAttribute('aria-expanded',String(statsOpen));
    $('pentaX01StatsPanel').hidden=!statsOpen;
    $('pentaStatsBackdrop').hidden=!statsOpen;
    if(statsOpen)$('pentaStatsClose').focus();
    else if(document.activeElement===$('pentaStatsClose'))$('pentaStatsOpen').focus();
  }

  const create=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  function persist(){
    if(!state)return;
    try{localStorage.setItem(STORE,JSON.stringify(state))}catch(error){
      feedback='Kunne ikke lagre automatisk på denne enheten. Sjekk ledig lagringsplass.';
    }
  }
  function stored(){
    try{return E.restore(JSON.parse(localStorage.getItem(STORE)||'null'))}catch(_){return null}
  }
  function showResume(){const old=stored();$('pentaResume').hidden=!old; if(old)$('pentaResume').textContent=old.status==='finished'?'Åpne forrige resultat':'Gjenoppta forrige femkamp'}
  function course(){
    const wrap=$('pentaCourse');
    E.STAGES.forEach((stage,index)=>{
      const pill=create('span','penta-course-item');
      pill.append(create('b','',String(index+1).padStart(2,'0')),document.createTextNode(stage.label));
      wrap.appendChild(pill);
    });
  }
  function makeNumberGrid(){
    const wrap=$('pentaNumbers');
    for(let n=20;n>=1;n--){
      const button=create('button','',n);
      button.type='button';button.dataset.number=String(n);
      button.addEventListener('click',()=>addDart(n,mult));
      wrap.appendChild(button);
    }
    $('penta25').addEventListener('click',()=>addDart(25,1));
    $('penta50').addEventListener('click',()=>addDart(25,2));
    $('pentaMiss').addEventListener('click',()=>addDart(0,0));
    $('pentaMults').querySelectorAll('[data-mult]').forEach(button=>{
      button.addEventListener('click',()=>{
        mult=Number(button.dataset.mult);
        renderMultiplier();
      });
    });
  }
  function renderMultiplier(){
    $('pentaMults').querySelectorAll('[data-mult]').forEach(button=>{
      const active=Number(button.dataset.mult)===mult;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }
  function liveTotal(player){
    return state.total[player]+(state.status==='playing'?state.current.pent[player]:0);
  }
  function leaderboard(){
    const wrap=$('pentaPlayers');
    wrap.replaceChildren();
    const scores=[liveTotal(0),liveTotal(1)];
    for(let p=0;p<2;p++){
      const box=create('div','penta-player-card'+(scores[p]>scores[1-p]?' leading':''));
      const left=create('div');
      left.append(create('span','','SPILLER '+(p+1)),create('h3','',state.players[p]));
      const right=create('div','penta-total',scores[p]);
      right.appendChild(create('small','','PENTATHLON-POENG'));
      box.append(left,right);
      wrap.appendChild(box);
    }
  }
  // Ordinary X01 3-dart average: scored points / actual darts used * 3.
  // Busts count as darts but score zero; only the active X01 exercise is included.
  function x01Average(entries,player,used){
    if(!used)return '–';
    const scored=entries.filter(entry=>entry.type==='visit'&&entry.player===player)
      .reduce((sum,entry)=>sum+Number(entry.score||0),0);
    return (scored*3/used).toFixed(2).replace('.',',');
  }
  function x01Starter(stageIndex){
    return (state.firstStarter+stageIndex)%2;
  }
  function x01SummaryStats(summary,player){
    const starters=x01Starter(state.summaries.indexOf(summary));
    const block=create('div','penta-x01-review-stats');
    block.append(
      create('small','','3-PILSSNITT: '+x01Average(summary.entries,player,summary.used[player])),
      create('small','','PILER: '+summary.used[player]),
      create('small','','STARTET LEGET: '+(starters===player?'JA':'NEI'))
    );
    return block;
  }
  function x01LiveStats(){
    const c=state.current;
    for(let p=0;p<2;p++){
      const visits=c.entries.filter(e=>e.type==='visit'&&e.player===p);
      const first=visits.slice(0,3);
      const firstDarts=Math.min(c.used[p],9);
      const firstAvg=firstDarts?(first.reduce((n,e)=>n+e.score,0)*3/firstDarts).toFixed(2):'0.00';
      const put=(field,value)=>{const node=$('pentaH2H'+field+p);if(node)node.textContent=String(value)};
      put('StatsName',state.players[p]);put('StatsName'+p+'b','');
      const bName=$('pentaH2HStatsName'+p+'b');if(bName)bName.textContent=state.players[p];
      put('StatAvg',c.used[p]?x01Average(c.entries,p,c.used[p]).replace(',','.'):'0.00');
      put('StatFirst9',firstAvg);
      put('StatCheckout',Math.max(0,...visits.filter(e=>e.checkout).map(e=>e.score))||'–');
      put('StatFastest',c.win===p?c.used[p]+' piler':'–');
      put('Stat100',visits.filter(e=>e.score>=100).length);
      put('Stat140',visits.filter(e=>e.score>=140).length);
      put('Stat170',visits.filter(e=>e.score>=170).length);
      put('Stat180',visits.filter(e=>e.score===180).length);
    }
  }
  let correctionIndex=-1,pendingCheckout=null;
  const checkoutOptions=score=>[1,2,3].filter(d=>E.isCheckout(score,d));
  function closeCheckout(){
    pendingCheckout=null;$('pentaCheckout').hidden=true;
    if(state?.status==='playing')$('pentaVisit').focus({preventScroll:true});
  }
  // Focus only for keyboard scoring, never steal focus from an open dialog.
  function focusX01Score(){
    if(window.matchMedia('(max-width:700px)').matches)return;
    setTimeout(()=>{
      if(state?.status!=='playing'||state.current.kind!=='x01'||pendingCheckout||
        !$('pentaCheckout').hidden||!$('pentaCorrectionModal').hidden||
        !$('pentaX01StatsPanel').hidden)return;
      const input=$('pentaVisit');
      if(input.disabled||input.closest('[hidden]'))return;
      input.focus({preventScroll:true});
      input.select();
    },0);
  }
  function commitX01(payload){
    try{
      state=E.submitX01(state,payload);
      pendingCheckout=null;$('pentaCheckout').hidden=true;
      feedback=state.status==='review'?'Øvelsen er avsluttet!':
        'Registrert '+(payload.bust?'BUST':payload.score)+'. '+state.players[state.current.turn]+' kaster nå.';
      $('pentaFeedback').style.borderColor='';
      $('pentaVisit').value='';$('pentaBust').checked=false;
      persist();render();
      if(state.status==='review')$('pentaReviewPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
      else focusX01Score();
    }catch(error){report(error)}
  }
  function openCheckout(score){
    const available=checkoutOptions(score);
    if(!available.length){report(Error('Dette er ikke en mulig utsjekk. Bruk BUST hvis turen ble ugyldig.'));return}
    pendingCheckout={score,player:state.current.turn};
    $('pentaCheckoutTitle').textContent='Utsjekk: '+score+' poeng';
    $('pentaCheckoutText').textContent=state.players[pendingCheckout.player]+': bekreft at siste pil traff en dobbel.';
    const options=$('pentaCheckoutDarts'),buttons=$('pentaCheckoutChoices');
    options.replaceChildren();buttons.replaceChildren();
    for(const darts of available){
      const opt=create('option','',darts+' pil'+(darts===1?'':'er'));opt.value=String(darts);options.appendChild(opt);
      const btn=create('button','primary',darts);btn.type='button';
      btn.title=darts+' '+(darts===1?'pil':'piler');
      btn.addEventListener('click',()=>finishCheckoutDarts(darts));buttons.appendChild(btn);
    }
    options.value=String(available[available.length-1]);
    $('pentaCheckout').hidden=false;
    buttons.querySelector('button')?.focus();
  }
  function finishCheckoutDarts(darts){
    if(!pendingCheckout||!checkoutOptions(pendingCheckout.score).includes(darts))return;
    $('pentaCheckoutDarts').value=String(darts);
    $('pentaCheckoutForm').requestSubmit();
  }
  function closeCorrection(){
    correctionIndex=-1;$('pentaCorrectionModal').hidden=true;
    $('pentaCorrectionCheckout').hidden=true;$('pentaCorrectionError').hidden=true;
    if(state?.status==='playing')$('pentaVisit').focus({preventScroll:true});
  }
  function correctionOptions(){
    const entry=state?.current?.entries?.[correctionIndex];
    const target=$('pentaCorrectionCheckout');
    target.hidden=true;
    if(!entry||entry.type!=='visit')return;
    const score=Number($('pentaCorrectionScore').value);
    const original=state.current.entries;
    const before=state.current.start-original.slice(0,correctionIndex)
      .filter(e=>e.player===entry.player).reduce((sum,e)=>sum+Number(e.score||0),0);
    if($('pentaCorrectionScore').value.trim()===''||score!==before||correctionIndex!==original.length-1)return;
    const choices=checkoutOptions(score);if(!choices.length)return;
    const select=$('pentaCorrectionDarts');select.replaceChildren();
    for(const n of choices){const option=create('option','',n+' pil'+(n===1?'':'er'));option.value=String(n);select.appendChild(option)}
    select.value=String(choices[choices.length-1]);
    target.hidden=false;
  }
  function openCorrection(index){
    if(state?.status!=='playing'||state.current.kind!=='x01')return;
    const entry=state.current.entries[index];
    if(!entry||entry.type!=='visit')return;
    if(!state.undo?.some(s=>s.stageIndex===state.stageIndex&&s.status==='playing'&&s.current?.entries?.length===index)){
      feedback='Kastet ligger utenfor angrehistorikken og kan ikke korrigeres.';
      $('pentaFeedback').textContent=feedback;return;
    }
    correctionIndex=index;
    $('pentaCorrectionTitle').textContent='Korriger kast';
    $('pentaCorrectionContext').textContent=state.players[entry.player]+' · leg '+(state.stageIndex+1)+' · tidligere '+(entry.bust?'BUST':entry.score+' poeng');
    $('pentaCorrectionScore').value=String(entry.score);
    $('pentaCorrectionError').hidden=true;
    correctionOptions();
    $('pentaCorrectionModal').hidden=false;
    $('pentaCorrectionScore').focus();
  }
  function saveCorrection(event){
    event.preventDefault();
    if(correctionIndex<0||!state||state.status!=='playing')return;
    const raw=$('pentaCorrectionScore').value.trim(),replacement=Number(raw);
    const error=$('pentaCorrectionError');
    if(!raw||!E.isScore(replacement)){error.textContent='Ugyldig X01-score.';error.hidden=false;return}
    const original=state.current.entries.slice(),idx=correctionIndex;
    let position=-1;
    for(let i=state.undo.length-1;i>=0;i--){
      const record=state.undo[i];
      if(record.stageIndex===state.stageIndex&&record.status==='playing'&&record.current?.entries?.length===idx){position=i;break}
    }
    if(position<0){error.textContent='Kastet ligger ikke lenger i angrehistorikken.';error.hidden=false;return}
    const baseline=JSON.parse(JSON.stringify(state.undo[position]));
    baseline.undo=state.undo.slice(0,position);
    let corrected=baseline;
    try{
      for(let i=idx;i<original.length;i++){
        const entry=original[i],first=i===idx;
        const score=first?replacement:entry.attempt;
        const checkout=first?!$('pentaCorrectionCheckout').hidden:entry.checkout;
        corrected=E.submitX01(corrected,{
          score,bust:first?false:entry.bust,doubleConfirmed:checkout,
          darts:first&&checkout?Number($('pentaCorrectionDarts').value):entry.darts
        });
      }
      state=corrected;
      feedback='Kast korrigert til '+replacement+' poeng.';
      persist();closeCorrection();render();
    }catch(ex){
      error.textContent=ex.message+' Senere kast må fremdeles være gyldige. Ingen endringer er lagret.';
      error.hidden=false;
    }
  }
  function renderX01Board(){
    const c=state.current;
    for(let p=0;p<2;p++){
      const card=$('pentaH2HPlayer'+p);
      card.classList.toggle('active',c.turn===p);
      $('pentaH2HPlayerName'+p).textContent=state.players[p];
      $('pentaH2HDarts'+p).textContent=c.used[p];
      $('pentaH2HScore'+p).textContent=c.remaining[p];
      $('pentaH2HAverage'+p).textContent=c.used[p]?x01Average(c.entries,p,c.used[p]).replace(',','.'):'–';
      $('pentaH2HLegs'+p).textContent=c.win===p?'1':'0';
      $('pentaH2HStarterMarker'+p).hidden=c.starter!==p;
    }
    $('pentaX01Turn').textContent=state.players[c.turn]+' kaster · '+c.remaining[c.turn]+' igjen';
    x01LiveStats();
    const throws=$('pentaX01Throws');
    throws.replaceChildren();
    for(let p=0;p<2;p++){
      const line=create('div','local-correction-line');
      line.appendChild(create('span','local-correction-name',state.players[p]));
      const chips=create('div','local-correction-chips');
      const visits=c.entries.map((entry,index)=>({entry,index}))
        .filter(item=>item.entry.type==='visit'&&item.entry.player===p).slice(-3);
      for(const item of visits){
        const entry=item.entry;
        const chip=create('button','local-throw-chip editable',entry.bust?'BUST':entry.score);
        chip.type='button';chip.title='Korriger dette kastet';
        chip.addEventListener('click',()=>openCorrection(item.index));
        chips.appendChild(chip);
      }
      if(!visits.length)chips.appendChild(create('span','local-throw-chip','Ingen kast ennå'));
      line.appendChild(chips);throws.appendChild(line);
    }
  }
  function renderShanghai(){
    const c=state.current,host=$('pentaShanghaiPlayers');
    host.replaceChildren();
    for(let p=0;p<2;p++){
      const visits=c.entries.filter(row=>row.player===p);
      const turns=[];
      for(let i=0;i<visits.length;i+=3)turns.push(visits.slice(i,i+3));
      const best=turns.length?Math.max(...turns.map(v=>v.reduce((sum,row)=>sum+Number(row.bonus||0),0))):0;
      const avg=turns.length?(c.pent[p]/turns.length).toFixed(2):'0.00';
      const card=create('article','local-player'+(c.turn===p?' active':''));
      card.style.order=p===c.starter?'0':'1';
      const top=create('div','local-player-top');
      top.append(create('small','','SPILLER '+(p+1)),create('span','local-current-marker','Kaster nå'));
      const band=create('div','local-score-band');
      const darts=create('div','local-live-darts');
      darts.append(create('b','',c.used[p]),create('span','','PILER'));
      const score=create('div','local-score',c.pent[p]);
      const average=create('div','local-avg');
      average.append(create('b','',avg),create('span','','P/R'));
      band.append(darts,score,average);
      card.append(top,create('h2','',state.players[p]),band,create('div','local-leg-label','PENTATHLON-POENG'));
      host.appendChild(card);
    }
    const n=E.currentTarget(state)?.number||1;
    $('pentaShanghaiActive').textContent=state.players[c.turn]+' kaster';
    $('pentaShanghaiPhase').textContent='SHANGHAI · MÅL '+n+'/9';
    $('pentaShanghaiTarget').textContent='Shanghai '+n;
    const existing=c.pending.map(E.labelDart);
    const chosen=shanghaiQueue.map(E.labelDart);
    const remaining=3-c.pending.length-shanghaiQueue.length;
    $('pentaShanghaiTurn').textContent=remaining+' piler denne turen';
    $('pentaShanghaiPending').textContent=[...existing,...chosen].join(' · ')||'–';
    $('pentaShanghaiRemove').disabled=!shanghaiQueue.length;
    $('pentaShanghaiSubmit').disabled=remaining!==0;
    $('pentaShanghaiMessage').textContent=remaining===0?'Tre piler valgt. Trykk Enter for å registrere.':'Velg treff, og trykk Enter etter tre piler.';
    const stats=$('pentaShanghaiStats');stats.replaceChildren();
    const names=create('div','special-stats-names');
    names.append(create('span','',''),create('strong','',state.players[0]),create('strong','',state.players[1]));
    stats.appendChild(names);
    const pairs=[
      ['Pentathlon-poeng',p=>c.pent[p]],
      ['Shanghai-bonus',p=>c.entries.filter(e=>e.player===p&&e.shanghai).length],
      ['Mål fullført',p=>Math.floor(c.used[p]/3)+'/9'],
      ['Beste runde',p=>{
        const entries=c.entries.filter(e=>e.player===p);
        let max=0;
        for(let i=0;i<entries.length;i+=3){
          max=Math.max(max,entries.slice(i,i+3).reduce((t,e)=>t+Number(e.bonus||0),0));
        }
        return max;
      }]
    ];
    for(const [label,calc] of pairs){
      const row=create('div','special-stats-cell');
      row.append(create('span','',label),create('strong','',calc(0)),create('strong','',calc(1)));
      stats.appendChild(row);
    }
    const history=$('pentaShanghaiLog');history.replaceChildren();
    const rows=c.entries.slice(-12).reverse();
    if(!rows.length)history.appendChild(create('div','penta-hint','Ingen kast ennå.'));
    for(const e of rows){
      const line=create('div','penta-jdc-history-row');
      line.append(create('strong','',state.players[e.player]),create('span','',e.target+' · '+e.hit),create('b','', '+'+e.bonus+' P'+(e.shanghai?' · SHANGHAI!':'')));
      history.appendChild(line);
    }
  }
  function renderClock(){
    const c=state.current,host=$('pentaClockPlayers');
    host.replaceChildren();
    for(let p=0;p<2;p++){
      const card=create('article','local-player'+(c.turn===p?' active':''));
      card.style.order=p===c.starter?'0':'1';
      const top=create('div','local-player-top');
      top.append(create('small','','SPILLER '+(p+1)),create('span','local-current-marker','Kaster nå'));
      const band=create('div','local-score-band');
      const darts=create('div','local-live-darts');
      darts.append(create('b','',c.used[p]),create('span','','PILER'));
      const score=create('div','local-score',c.pent[p]);
      const stats=create('div','local-avg');
      const visits=Math.ceil(c.used[p]/3);
      stats.append(create('b','',visits?(c.pent[p]/visits).toFixed(2):'0.00'),create('span','','P/R'));
      band.append(darts,score,stats);
      card.append(top,create('h2','',state.players[p]),band,create('div','local-leg-label','PENTATHLON-POENG'));
      host.appendChild(card);
    }
    const p=c.turn,n=clockPreviewTarget(),completed=n>20;
    $('pentaClockActive').textContent=state.players[p]+' kaster';
    $('pentaClockTarget').textContent=completed?'D20 FULLFØRT':'D'+n;
    $('pentaClockPhase').textContent='KLOKKA · D1–D20';
    const remaining=Math.min(3-c.pending.length,42-c.used[p])-clockQueue.length;
    $('pentaClockTurn').textContent=completed?'Alle dobbeltmål truffet':remaining+' piler denne turen';
    $('pentaClockPending').textContent=[...c.pending.map(E.labelDart),...clockQueue.map(E.labelDart)].join(' · ')||'–';
    $('pentaClockRemove').disabled=!clockQueue.length;
    $('pentaClockMiss').disabled=completed||remaining<=0;
    $('pentaClockHit').disabled=completed||remaining<=0;
    $('pentaClockSubmit').disabled=!clockQueue.length||(!completed&&remaining>0);
    $('pentaClockMessage').textContent=completed?'D20 truffet. Trykk Enter for å fullføre turen.':remaining===0?'Tre piler valgt. Trykk Enter for å registrere.':'Velg treff eller bom. Målet øker bare ved treff.';
    const stats=$('pentaClockStats');stats.replaceChildren();
    const head=create('div','special-stats-names');
    head.append(create('span','',''),create('strong','',state.players[0]),create('strong','',state.players[1]));
    stats.appendChild(head);
    const rows=[
      ['Pentathlon-poeng',p=>c.pent[p]],
      ['Siste dobbel',p=>Math.min(20,c.clockTarget[p]-1)],
      ['Piler brukt',p=>c.used[p]+'/42'],
      ['Dobbeltmål truffet',p=>Math.min(20,c.clockTarget[p]-1)+'/20']
    ];
    for(const [label,calc] of rows){
      const row=create('div','special-stats-cell');
      row.append(create('span','',label),create('strong','',calc(0)),create('strong','',calc(1)));
      stats.appendChild(row);
    }
    const history=$('pentaClockLog');history.replaceChildren();
    const hits=c.entries.slice(-12).reverse();
    if(!hits.length)history.appendChild(create('div','penta-hint','Ingen kast ennå.'));
    for(const e of hits){
      const row=create('div','penta-jdc-history-row');
      row.append(create('strong','',state.players[e.player]),create('span','',e.target+' · '+e.hit),create('b','','+'+e.bonus+' P'));
      history.appendChild(row);
    }
  }
  function renderHalf(){
    const c=state.current,host=$('pentaHalfPlayers');host.replaceChildren();
    for(let p=0;p<2;p++){
      const card=create('article','local-player'+(c.turn===p?' active':''));
      card.style.order=p===c.starter?'0':'1';
      const head=create('div','local-player-top');
      head.append(create('small','','SPILLER '+(p+1)),create('span','local-current-marker','Kaster nå'));
      const band=create('div','local-score-band');
      const used=create('div','local-live-darts');
      used.append(create('b','',c.used[p]),create('span','','PILER'));
      const score=create('div','local-score',c.halfScores[p]);
      const average=create('div','local-avg');
      const completedRounds=Math.ceil(c.used[p]/3);
      average.append(create('b','',completedRounds?(c.halfScores[p]/completedRounds).toFixed(2):'0.00'),create('span','','P/R'));
      band.append(used,score,average);
      card.append(head,create('h2','',state.players[p]),band,create('div','local-leg-label',c.pent[p]+' PENTATHLON-POENG'));
      host.appendChild(card);
    }
    const p=c.turn,round=Math.min(6,Math.floor(c.used[p]/3)),target=HALF_TARGETS[round];
    $('pentaHalfActive').textContent=state.players[p]+' kaster';
    $('pentaHalfTarget').textContent=target.label;
    $('pentaHalfPhase').textContent='HALF-IT · MÅL '+(round+1)+'/7';
    $('pentaHalfTurn').textContent=(3-c.pending.length-halfQueue.length)+' piler denne turen';
    $('pentaHalfPending').textContent=[...c.pending,...halfQueue].map(E.labelDart).join(' · ')||'–';
    $('pentaHalfRemove').disabled=!halfQueue.length;
    const choices=$('pentaHalfChoices');choices.replaceChildren();
    const options=target.m===0?[1,2,3].map(m=>({n:target.n,m})):
      [{n:target.n,m:target.m}];
    for(const {n,m} of options){
      const button=create('button','outline special-choice');
      button.type='button';button.textContent=E.labelDart({n,m})+' ';
      button.append(create('span','da-key',m===1?'1':m===2?'2':'3'));
      button.addEventListener('click',()=>halfAdd(n,m));
      choices.appendChild(button);
    }
    $('pentaHalfMessage').textContent='Velg opptil 3 piler. Enter registrerer turen; ubrukte piler blir bom.';
    const stats=$('pentaHalfStats');stats.replaceChildren();
    const head=create('div','special-stats-names');
    head.append(create('span','',''),create('strong','',state.players[0]),create('strong','',state.players[1]));
    stats.appendChild(head);
    const rows=[
      ['Half-It-score',p=>c.halfScores[p]],
      ['Pentathlon-poeng',p=>c.pent[p]],
      ['Runder fullført',p=>Math.floor(c.used[p]/3)+'/7'],
      ['Piler brukt',p=>c.used[p]+'/21']
    ];
    for(const [label,fn] of rows){
      const row=create('div','special-stats-cell');
      row.append(create('span','',label),create('strong','',fn(0)),create('strong','',fn(1)));
      stats.appendChild(row);
    }
    const log=$('pentaHalfLog');log.replaceChildren();
    const entries=c.entries.slice(-12).reverse();
    if(!entries.length)log.appendChild(create('div','penta-hint','Ingen kast ennå.'));
    for(const item of entries){
      const row=create('div','penta-jdc-history-row');
      row.append(create('strong','',state.players[item.player]),create('span','',item.target+' · '+item.hit),create('b','',
        item.halved?'HALVERT':('+'+item.bonus+' P')));
      log.appendChild(row);
    }
  }
  function stageStats(){
    const c=state.current,wrap=$('pentaStagePlayers'),idx=state.stageIndex;
    const x01=c.kind==='x01';
    $('pentaX01Board').hidden=!x01;
    $('pentaX01Corrections').hidden=!x01;
    $('pentaStatsOpen').hidden=!x01;
    if(!x01)statsOpen=false;
    $('pentaX01StatsPanel').hidden=!x01||!statsOpen;
    $('pentaStatsBackdrop').hidden=!x01||!statsOpen;
    $('pentaStatsOpen').setAttribute('aria-expanded',String(statsOpen));
    const shanghai=c.kind==='shanghai',clock=c.kind==='clock',half=c.kind==='half';
    wrap.hidden=x01||shanghai||clock||half;
    $('pentaShanghaiGame').hidden=!shanghai;
    $('pentaClockGame').hidden=!clock;
    $('pentaHalfGame').hidden=!half;
    if(shanghai)renderShanghai();
    if(clock)renderClock();
    if(half)renderHalf();
    $('pentaTarget').parentElement.parentElement.hidden=x01||shanghai||clock||half;
    if(x01)renderX01Board();
    wrap.replaceChildren();
    wrap.classList.remove('penta-shanghai-board','local-board');
    for(let p=0;p<2;p++){
      const box=create('div','penta-stage-player'+(state.status==='playing'&&c.turn===p?' active':''));
      box.appendChild(create('small','',state.players[p]));
      box.appendChild(create('div','penta-number',c.kind==='x01'?c.remaining[p]+' REST':c.pent[p]+' P'));
      const sub=c.kind==='x01'
        ?c.used[p]+' PILER · '+c.visitCounts[p].tons+' TONS 100+'
        :c.kind==='half'?'HALF-IT SCORE '+c.halfScores[p]+' · '+c.used[p]+'/21 PILER'
        :c.kind==='clock'?'SISTE DOBBEL '+(c.clockTarget[p]-1)+' · '+c.used[p]+'/42 PILER'
        :'MÅL '+Math.min(9,Math.floor(c.used[p]/3)+1)+' · '+c.used[p]+'/27 PILER';
      box.appendChild(create('div','penta-minor',sub));
      if(c.kind==='x01'){
        const stats=create('div','penta-x01-live-stats');
        const avg=create('div','penta-x01-stat');
        avg.append(create('strong','',x01Average(c.entries,p,c.used[p])),create('small','','3-PILSSNITT'));
        const darts=create('div','penta-x01-stat');
        darts.append(create('strong','',c.used[p]),create('small','','PILER'));
        stats.append(avg,darts);
        box.appendChild(stats);
        if(c.starter===p)box.appendChild(create('div','penta-x01-starter','🎯 STARTET LEGET'));
        box.appendChild(create('div','penta-minor','PENTATHLON +'+c.pent[p]));
      }
      wrap.appendChild(box);
    }
    $('pentaStageCounter').textContent='ØVELSE '+(idx+1)+' AV '+E.STAGES.length;
    $('pentaStageName').textContent=E.STAGES[idx]?.label||'Ferdig';
    $('pentaStageDescription').textContent=E.STAGES[idx]?.caption||'';
    $('pentaTurnBadge').textContent=state.players[c.turn]+' kaster';
    const target=E.currentTarget(state);
    $('pentaTarget').textContent=target?.label||'FERDIG';
    $('pentaDartsRemaining').textContent=c.kind==='x01'?'REGISTRER KASTESUM':(c.kind==='clock'?(42-c.used[c.turn])+' PILER IGJEN':'PIL '+(c.pending.length+1)+' AV 3');
    $('pentaX01Controls').hidden=c.kind!=='x01';
    $('pentaDartControls').hidden=c.kind==='x01'||c.kind==='shanghai'||c.kind==='clock'||c.kind==='half';
    $('pentaDartAdvanced').hidden=false;
    if(c.kind!=='x01'){
      const slots=$('pentaDartSlots').children;
      for(let i=0;i<3;i++){
        slots[i].textContent=c.pending[i]?E.labelDart(c.pending[i]):'–';
      }
      $('pentaNumbers').querySelectorAll('button').forEach(button=>{
        button.classList.toggle('target',Number(button.dataset.number)===target?.number);
      });
      renderMultiplier();
    }
    
  }
  function recent(){
    const wrap=$('pentaRecent');wrap.replaceChildren();
    const entries=state.current.entries.slice(-9).reverse();
    if(!entries.length){wrap.appendChild(create('span','penta-hint','Ingen kast ennå.'));return}
    for(const entry of entries){
      let msg=state.players[entry.player]+': ';
      if(entry.type==='visit'){
        msg+=(entry.bust?'BUST':entry.score)+' · +'+entry.bonus+' P';
        if(entry.checkout)msg+=' · CHECKOUT ('+entry.darts+' piler)';
      }else{
        msg+=entry.hit+' → '+entry.target+' · +'+entry.bonus+' P';
        if(entry.shanghai)msg+=' · SHANGHAI!';
        if(entry.halved)msg+=' · HALF!';
      }
      wrap.appendChild(create('span','penta-recent-item',msg));
    }
  }
  function resultTable(){
    const host=$('pentaResultsTable');
    host.replaceChildren();
    const table=create('table','penta-table');
    const thead=create('thead'),tr=create('tr');
    for(const heading of ['ØVELSE',state.players[0],state.players[1]])tr.appendChild(create('th','',heading));
    thead.appendChild(tr);table.appendChild(thead);
    const tbody=create('tbody');
    E.STAGES.forEach((stage,i)=>{
      const row=create('tr');
      const summary=state.summaries[i];
      row.classList.toggle('future',!summary);
      row.appendChild(create('td','',(i+1)+'. '+stage.label));
      row.appendChild(create('td','',summary?summary.pent[0]:'–'));
      row.appendChild(create('td','',summary?summary.pent[1]:'–'));
      tbody.appendChild(row);
    });
    const totals=create('tr');
    totals.append(create('td','','TOTAL'),create('td','',liveTotal(0)),create('td','',liveTotal(1)));
    tbody.appendChild(totals);
    table.appendChild(tbody);host.appendChild(table);
  }
  function review(){
    const summary=state.summaries[state.summaries.length-1];
    if(!summary)return;
    $('pentaReviewTitle').textContent=summary.label+' · Resultat';
    const leading=summary.pent[0]===summary.pent[1]?'Uavgjort i denne øvelsen.':
      state.players[summary.pent[0]>summary.pent[1]?0:1]+' fikk flest Pentathlon-poeng i denne øvelsen.';
    $('pentaReviewCaption').textContent=leading+' Poengene er lagt til den samlede stillingen.';
    const wrap=$('pentaReviewDetails');wrap.className='penta-review-details';wrap.replaceChildren();
    for(let p=0;p<2;p++){
      const card=create('div');card.appendChild(create('h3','',state.players[p]));
      card.appendChild(create('strong','',summary.pent[p]+' poeng'));
      card.appendChild(create('small','','Totalt: '+summary.after[p]+' Pentathlon-poeng'));
      if(summary.kind==='x01'){
        const counts=summary.counts[p];
        card.appendChild(create('small','','95–130: '+counts.n95+' · 131–159: '+counts.n131+' · 160–180: '+counts.n160));
        card.appendChild(create('small','','Tons 100+: '+counts.tons));
        card.appendChild(x01SummaryStats(summary,p));
        if(summary.winner===p){
          const finishing=summary.entries.filter(e=>e.player===p&&e.checkout).at(-1);
          if(finishing)card.appendChild(create('small','','Leg vunnet +2 · rask utsjekk +'+finishing.speedBonus));
        }
      }else if(summary.kind==='half'){
        card.appendChild(create('small','','Half-It score: '+summary.halfScores[p]+' (ikke Pentathlon-poeng)'));
      }else{
        card.appendChild(create('small','','Piler kastet: '+summary.used[p]));
      }
      wrap.appendChild(card);
    }
    $('pentaNextStage').textContent=state.stageIndex===E.STAGES.length-1?'SE SLUTTRESULTAT →':'NESTE ØVELSE →';
  }
  function finish(){
    const [a,b]=state.total;
    const tied=a===b,winner=tied?-1:(a>b?0:1);
    const order=tied?[0,1]:[winner,1-winner];
    $('pentaWinner').textContent=tied?'UAVGJORT':state.players[winner]+' VINNER!';
    $('pentaFinishDescription').textContent=tied
      ?'Begge spillere endte med like mange Pentathlon-poeng.'
      :'Seier med '+Math.abs(a-b)+' poeng etter sju øvelser.';
    const score=$('pentaFinishScore');score.replaceChildren();
    score.append(create('strong','',state.total[order[0]]),create('span','','–'),
      create('strong','',state.total[order[1]]),create('small','','PENTATHLON-POENG'));
    const players=$('pentaFinishPlayers');players.replaceChildren();
    for(const p of order){
      const card=create('article','penta-finish-player'+(winner===p?' winner':''));
      const heading=create('div','penta-finish-player-head');
      const avatar=create('div','penta-finish-avatar',winner===p?'♛':state.players[p].trim().slice(0,1).toUpperCase());
      const detail=create('div','penta-finish-player-info');
      detail.append(create('div','penta-finish-name',state.players[p]));
      if(winner===p)detail.append(create('span','penta-finish-badge','VINNER'));
      else if(tied)detail.append(create('span','penta-finish-badge tie','UAVGJORT'));
      heading.append(avatar,detail);
      const result=create('div','penta-finish-player-score');
      result.append(create('strong','',state.total[p]),create('span','','POENG'));
      const wins=state.summaries.filter(item=>item.pent[p]>item.pent[1-p]).length;
      const rows=create('div','penta-finish-player-metrics');
      for(const [label,value] of [['Øvelser med flest poeng',wins+' / 7'],
        ['501-leg og X01',state.summaries.slice(0,4).reduce((n,item)=>n+item.pent[p],0)+' P'],
        ['Shanghai · Klokka · Half-It',state.summaries.slice(4).reduce((n,item)=>n+item.pent[p],0)+' P']]){
        const row=create('div','penta-finish-metric');
        row.append(create('span','',label),create('b','',value));rows.appendChild(row);
      }
      card.append(heading,result,rows);players.appendChild(card);
    }
    const rounds=$('pentaFinishRounds');rounds.replaceChildren();
    const header=create('div','penta-finish-round penta-finish-round-header');
    header.append(create('span','','ØVELSE'),
      create('span','',state.players[order[0]]),create('span','',state.players[order[1]]));
    rounds.appendChild(header);
    for(const summary of state.summaries){
      const row=create('div','penta-finish-round');
      row.append(create('span','',summary.label),
        create('strong',summary.pent[order[0]]>summary.pent[order[1]]?'leading':'',summary.pent[order[0]]),
        create('strong',summary.pent[order[1]]>summary.pent[order[0]]?'leading':'',summary.pent[order[1]]));
      rounds.appendChild(row);
    }
    const total=create('div','penta-finish-round penta-finish-round-total');
    total.append(create('span','','TOTAL'),create('strong','',state.total[order[0]]),create('strong','',state.total[order[1]]));
    rounds.appendChild(total);
  }
  function render(){
    if(!state)return;
    $('pentaSetup').hidden=true;$('pentaGame').hidden=false;
    $('pentaStatus').textContent=state.status==='finished'?'PENTATHLON FULLFØRT':
      'ØVELSE '+(state.stageIndex+1)+' AV '+E.STAGES.length;
    $('pentaUndo').disabled=!state.undo?.length;
    if(state.status!=='playing'||state.current.kind!=='x01')setStatsOpen(false);
    const progress=$('pentaProgress');progress.replaceChildren();
    E.STAGES.forEach((stage,i)=>{
      const item=create('div',i<state.summaries.length?'done':(i===state.stageIndex?'active':''),stage.label);
      item.title=stage.caption;
      progress.appendChild(item);
    });
    leaderboard();
    resultTable();
    $('pentaActivePanel').hidden=state.status!=='playing';
    $('pentaReviewPanel').hidden=state.status!=='review';
    $('pentaFinishedPanel').hidden=state.status!=='finished';
    if(state.status==='playing')stageStats();
    if(state.status==='review')review();
    if(state.status==='finished')finish();
    if(state.status==='playing'){
      recent();$('pentaFeedback').textContent=feedback;
    }
  }
  function report(error){
    feedback=error.message||String(error);
    $('pentaFeedback').textContent=feedback;
    $('pentaFeedback').style.borderColor='#a65b66';
  }
  function submitX01(event){
    event.preventDefault();
    if(state?.status!=='playing'||state.current.kind!=='x01'||pendingCheckout)return;
    const raw=$('pentaVisit').value.trim();
    if(!raw){report(Error('Skriv en score fra 0 til 180.'));return}
    const score=Number(raw);
    if(!E.isScore(score)){report(Error('Ugyldig X01-score.'));return}
    const remaining=state.current.remaining[state.current.turn];
    if(score===remaining){openCheckout(score);return}
    commitX01({score,bust:false,doubleConfirmed:false,darts:3});
  }
  function addDart(n,m){
    if(state?.status!=='playing'||state.current.kind==='x01')return;
    try{
      const target=E.currentTarget(state);
      state=E.submitDart(state,{n,m});
      const last=state.current.entries.at(-1);
      feedback=state.players[last.player]+': '+last.hit+' mot '+target.label+
        ' · +'+last.bonus+' Pentathlon-poeng'+(last.shanghai?' · SHANGHAI!':'')+
        (last.halved?' · Half-It-score halvert!':'');
      $('pentaFeedback').style.borderColor='';
      persist();render();
      if(state.status==='review')$('pentaReviewPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(error){report(error)}
  }
  async function start(){
    if(starting)return;
    starting=true;
    const button=$('pentaStart'),resumeButton=$('pentaResume');
    button.disabled=true;
    resumeButton.disabled=true;
    try{
      const random=$('pentaStarter').value==='random';
      const starter=random?Math.floor(Math.random()*2):Number($('pentaStarter').value);
      // Validate names and starter before animation; store only after the coin lands.
      const next=E.create({name1:$('pentaName0').value,name2:$('pentaName1').value,starter});
      $('pentaSetupError').textContent='';
      if(random){
        if(typeof window.DartArenaCoinFlip?.play!=='function'){
          throw Error('Myntkastet er ikke tilgjengelig. Last inn siden på nytt.');
        }
        await window.DartArenaCoinFlip.play({
          player1Id:'pentathlon-player-0',
          player2Id:'pentathlon-player-1',
          player1Name:next.players[0],
          player2Name:next.players[1],
          winnerId:starter===0?'pentathlon-player-0':'pentathlon-player-1',
          duration:3300
        });
      }
      state=next;
      shanghaiQueue=[];saveShanghaiQueue();clockQueue=[];saveClockQueue();halfQueue=[];saveHalfQueue();
      feedback=state.players[starter]+' starter første 501-leg.';
      persist();render();
      $('pentaGame').scrollIntoView({block:'start',behavior:'smooth'});
      focusX01Score();
    }catch(error){
      $('pentaSetupError').textContent=error.message||String(error);
    }finally{
      starting=false;
      button.disabled=false;
      resumeButton.disabled=false;
    }
  }
  function resume(){const saved=stored();if(!saved)return;state=saved;restoreShanghaiQueue();restoreClockQueue();restoreHalfQueue();feedback='Femkampen er gjenopptatt.';render();focusX01Score()}
  function undo(){
    if(!state)return;
    try{
      if(state.status==='playing'&&state.current.kind==='half'&&halfQueue.length){
        halfRemove();return;
      }
      if(state.status==='playing'&&state.current.kind==='clock'&&clockQueue.length){
        clockRemoveHit();return;
      }
      if(state.status==='playing'&&state.current.kind==='shanghai'&&shanghaiQueue.length){
        shanghaiRemoveHit();return;
      }
      if(['shanghai','clock','half'].includes(state.current.kind)&&state.current.entries.length){
        // A JDC turn is confirmed as one action. Undo all committed darts
        // from the most recent turn rather than leaving a half-registered one.
        const entries=state.current.entries;
        const lastPlayer=entries[entries.length-1].player;
        let n=0;
        for(let i=entries.length-1;i>=0&&n<3&&entries[i].player===lastPlayer;i--)n++;
        for(let i=0;i<n;i++)state=E.undo(state);
      }else state=E.undo(state);
      shanghaiQueue=[];saveShanghaiQueue();clockQueue=[];saveClockQueue();halfQueue=[];saveHalfQueue();
      feedback='Forrige registrering angret.';persist();render();focusX01Score()
    }
    catch(error){report(error)}
  }
  function reset(){
    if(state&&!window.confirm('Starte en ny Pentathlon? Nåværende resultat og angrehistorikk overskrives.'))return;
    state=null;shanghaiQueue=[];clockQueue=[];halfQueue=[];
    try{localStorage.removeItem(STORE);localStorage.removeItem(SHANGHAI_QUEUE_KEY);localStorage.removeItem(CLOCK_QUEUE_KEY);localStorage.removeItem(HALF_QUEUE_KEY)}catch(_){}
    $('pentaGame').hidden=true;$('pentaSetup').hidden=false;showResume();
    $('pentaSetup').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function nextStage(){
    if(state?.status!=='review')return;
    try{
      state=E.nextStage(state);
      shanghaiQueue=[];saveShanghaiQueue();clockQueue=[];saveClockQueue();halfQueue=[];saveHalfQueue();
      feedback='Neste øvelse er klar. '+state.players[state.current.turn]+' starter.';
      persist();render();
      $('pentaGame').scrollIntoView({block:'start',behavior:'smooth'});
      focusX01Score();
    }catch(error){report(error)}
  }
  function exportCsv(){
    if(!state||state.status!=='finished')return;
    const safe=value=>{
      const string=String(value??'');
      const protectedValue=/^[\s]*[=+\-@]/.test(string)?"'"+string:string;
      return '"'+protectedValue.replaceAll('"','""')+'"';
    };
    const rows=[['Øvelse',...state.players]];
    state.summaries.forEach(summary=>rows.push([summary.label,...summary.pent]));
    rows.push(['TOTAL',...state.total]);
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=create('a');
    link.href=url;link.download='dartarena-pentathlon-2p.csv';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('pentaStatsOpen').addEventListener('click',()=>setStatsOpen(!statsOpen));
  $('pentaStatsClose').addEventListener('click',()=>setStatsOpen(false));
  $('pentaStatsBackdrop').addEventListener('click',()=>setStatsOpen(false));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&statsOpen)setStatsOpen(false);
  });

  $('pentaShanghaiGame').querySelectorAll('[data-shanghai-mult]').forEach(button=>{
    button.addEventListener('click',()=>{
      if(state?.status!=='playing'||state.current.kind!=='shanghai')return;
      const target=E.currentTarget(state);
      if(target?.number)shanghaiQueueHit(target.number,Number(button.dataset.shanghaiMult));
    });
  });
  $('pentaShanghaiMiss').addEventListener('click',()=>{
    if(state?.status==='playing'&&state.current.kind==='shanghai')shanghaiQueueHit(0,0);
  });
  // Shanghai scoring: 1=S, 2=D, 3=T, 0=BOM on the current target.
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.ctrlKey||event.altKey||
       event.metaKey||event.isComposing||state?.status!=='playing')return;
    const target=event.target;
    if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)||
       target?.closest?.('[role="dialog"]'))return;
    if(state.current.kind==='shanghai'&&['1','2','3','0'].includes(event.key)){
      const n=E.currentTarget(state)?.number;
      if(!n)return;
      event.preventDefault();
      shanghaiQueueHit(event.key==='0'?0:n,event.key==='0'?0:Number(event.key));
      return;
    }
    if(state.current.kind==='x01'&&event.key.length===1&&/^[0-9]$/.test(event.key)&&
      !pendingCheckout&&$('pentaCheckout').hidden&&$('pentaCorrectionModal').hidden&&
      $('pentaX01StatsPanel').hidden){
      event.preventDefault();
      const input=$('pentaVisit');
      input.value=event.key;
      input.focus({preventScroll:true});
      input.setSelectionRange(input.value.length,input.value.length);
    }
  });
  $('pentaHalfMiss').addEventListener('click',()=>halfAdd(0,0));
  $('pentaHalfRemove').addEventListener('click',halfRemove);
  $('pentaHalfSubmit').addEventListener('click',halfSubmit);
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
      event.isComposing||state?.status!=='playing'||state.current.kind!=='half')return;
    const target=event.target;
    if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
    if(event.key==='0'){event.preventDefault();halfAdd(0,0)}
    else if(['1','2','3'].includes(event.key)){
      const rule=HALF_TARGETS[Math.min(6,Math.floor(state.current.used[state.current.turn]/3))];
      const m=rule.m||Number(event.key);
      if(rule.m===0||Number(event.key)===rule.m){
        event.preventDefault();halfAdd(rule.n,m);
      }
    }else if(event.key==='Enter'){event.preventDefault();halfSubmit()}
    else if(event.key==='Backspace'){event.preventDefault();halfRemove()}
  });
  $('pentaClockMiss').addEventListener('click',()=>clockQueueHit(false));
  $('pentaClockHit').addEventListener('click',()=>clockQueueHit(true));
  $('pentaClockRemove').addEventListener('click',clockRemoveHit);
  $('pentaClockSubmit').addEventListener('click',clockSubmitTurn);
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
       event.isComposing||state?.status!=='playing'||state.current.kind!=='clock')return;
    const target=event.target;
    if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
    if(event.key==='0'){event.preventDefault();clockQueueHit(false)}
    else if(event.key==='2'){event.preventDefault();clockQueueHit(true)}
    else if(event.key==='Enter'){event.preventDefault();clockSubmitTurn()}
    else if(event.key==='Backspace'){event.preventDefault();clockRemoveHit()}
  });
  $('pentaShanghaiRemove').addEventListener('click',shanghaiRemoveHit);
  $('pentaShanghaiSubmit').addEventListener('click',shanghaiSubmitTurn);
  // JDC: Enter confirms the whole 3-dart turn; Backspace removes the latest unconfirmed dart.
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
       event.isComposing||state?.status!=='playing'||state.current.kind!=='shanghai')return;
    const target=event.target;
    if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
    if(event.key==='Enter'){event.preventDefault();shanghaiSubmitTurn()}
    else if(event.key==='Backspace'){event.preventDefault();shanghaiRemoveHit()}
  });
  $('pentaStart').addEventListener('click',start);
  $('pentaResume').addEventListener('click',resume);
  $('pentaReset').addEventListener('click',reset);
  $('pentaUndo').addEventListener('click',undo);
  $('pentaNextStage').addEventListener('click',nextStage);
  $('pentaExport').addEventListener('click',exportCsv);
  $('pentaX01Form').addEventListener('submit',submitX01);
  $('pentaCorrectionScore').addEventListener('input',()=>{$('pentaCorrectionError').hidden=true;correctionOptions()});
  $('pentaCorrectionForm').addEventListener('submit',saveCorrection);
  $('pentaCorrectionCancel').addEventListener('click',closeCorrection);
  $('pentaCorrectionModal').querySelector('.local-modal-backdrop').addEventListener('click',closeCorrection);
  $('pentaCheckoutForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!pendingCheckout||state?.current?.turn!==pendingCheckout.player)return closeCheckout();
    commitX01({score:pendingCheckout.score,bust:false,doubleConfirmed:true,darts:Number($('pentaCheckoutDarts').value)});
  });
  $('pentaCheckout').querySelector('.local-modal-backdrop').addEventListener('click',closeCheckout);
  $('pentaCheckoutCancel').addEventListener('click',closeCheckout);
  $('pentaCheckoutBust').addEventListener('click',()=>{
    if(!pendingCheckout)return closeCheckout();
    commitX01({score:pendingCheckout.score,bust:true,doubleConfirmed:false,darts:3});
  });
  $('pentaBustButton').addEventListener('click',()=>{
    if(state?.status!=='playing'||state.current.kind!=='x01'||pendingCheckout)return;
    commitX01({score:0,bust:true,doubleConfirmed:false,darts:3});
  });
  document.addEventListener('keydown',event=>{
    // On the result/review screen Enter means "Neste øvelse", even if
    // keyboard focus remains on a control from the just-completed exercise.
    // Capture the key before the browser can activate a stale focused button.
    if(event.key==='Enter'&&state?.status==='review'&&!event.repeat&&
       !event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.isComposing&&
       $('pentaCheckout').hidden&&$('pentaCorrectionModal').hidden){
      event.preventDefault();
      event.stopImmediatePropagation();
      nextStage();
      return;
    }
    if(event.key==='Escape'){
      if(!$('pentaCheckout').hidden){event.preventDefault();closeCheckout()}
      else if(!$('pentaCorrectionModal').hidden){event.preventDefault();closeCorrection()}
    }else if(!$('pentaCheckout').hidden&&['1','2','3'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();finishCheckoutDarts(Number(event.key));
    }
  },true);
  $('pentaMobileKeypad').addEventListener('click',event=>{
    const key=event.target.closest('button');
    if(!key)return;
    const input=$('pentaVisit');
    if(key.dataset.pentaKey!==undefined){
      input.value=(input.value+key.dataset.pentaKey).slice(0,3);
      
    }else if(key.dataset.pentaAction==='delete'){
      input.value=input.value.slice(0,-1);
    }else if(key.dataset.pentaAction==='enter'){
      $('pentaX01Form').requestSubmit();
    }
  });
  course();makeNumberGrid();renderMultiplier();
  // Opening or refreshing an unfinished game must resume without revisiting setup.
  const saved=stored();
  if(saved){
    state=saved;
    restoreShanghaiQueue();restoreClockQueue();restoreHalfQueue();
    feedback=saved.status==='review'?'Øvelsen er fullført. Fortsett når du er klar.':
      saved.status==='finished'?'Tidligere Pentathlon-resultat gjenopprettet.':
      'Pentathlon gjenopprettet på samme øvelse.';
    render();
    focusX01Score();
  }else{
    showResume();
  }
})();
