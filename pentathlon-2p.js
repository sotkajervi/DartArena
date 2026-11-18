/* Pentathlon 2P – fully local; no Supabase, camera or online match mutations. */
(function() {
  'use strict';
  const E=window.DartArenaPentathlon;
  if(!E)return;
  const $=id=>document.getElementById(id);
  const STORE='dartarena-pentathlon-local-2p-v1';
  let state=null,mult=1,feedback='Klar for første kast.';
  let starting=false;
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
    const c=state.current,host=$('pentaX01Stats');
    if(!host)return;
    host.replaceChildren();
    const rows=[
      ['3-dart AVG',p=>x01Average(c.entries,p,c.used[p])],
      ['First 9 AVG',p=>{
        const visits=c.entries.filter(e=>e.type==='visit'&&e.player===p).slice(0,3);
        const darts=Math.min(9,c.used[p]);
        return darts?(visits.reduce((n,e)=>n+e.score,0)*3/darts).toFixed(2).replace('.',','):'–';
      }],
      ['Piler',p=>c.used[p]],
      ['100+',p=>c.entries.filter(e=>e.type==='visit'&&e.player===p&&e.score>=100).length],
      ['140+',p=>c.entries.filter(e=>e.type==='visit'&&e.player===p&&e.score>=140).length],
      ['170+',p=>c.entries.filter(e=>e.type==='visit'&&e.player===p&&e.score>=170).length],
      ['180',p=>c.entries.filter(e=>e.type==='visit'&&e.player===p&&e.score===180).length],
      ['Høyeste checkout',p=>Math.max(0,...c.entries.filter(e=>e.type==='visit'&&e.player===p&&e.checkout).map(e=>e.score))||'–'],
      ['Pentathlon-poeng',p=>c.pent[p]]
    ];
    const head=create('div','penta-x01-row penta-x01-head');
    head.append(create('span','','STATISTIKK'),...state.players.map(name=>create('strong','',name)));
    host.appendChild(head);
    rows.forEach(([title,value])=>{
      const row=create('div','penta-x01-row');
      row.append(create('span','',title),create('strong','',value(0)),create('strong','',value(1)));
      host.appendChild(row);
    });
  }
  let correctionIndex=-1;
  function closeCorrection(){
    correctionIndex=-1;
    $('pentaCorrectionModal').hidden=true;
    $('pentaCorrectionError').textContent='';
  }
  function openCorrection(index){
    if(state?.status!=='playing'||state.current.kind!=='x01')return;
    const entry=state.current.entries[index];
    if(!entry||entry.type!=='visit')return;
    // A correction can only be replayed while its preceding snapshot is retained.
    const snapshot=state.undo?.some(s=>s.stageIndex===state.stageIndex&&s.status==='playing'&&s.current?.entries?.length===index);
    if(!snapshot){
      feedback='Dette kastet ligger utenfor angrehistorikken og kan ikke korrigeres automatisk.';
      $('pentaFeedback').textContent=feedback;
      return;
    }
    correctionIndex=index;
    $('pentaCorrectionContext').textContent=state.players[entry.player]+
      ' · kast '+(state.current.entries.filter((e,i)=>i<=index&&e.player===entry.player).length)+
      ' · tidligere '+(entry.bust?'BUST':entry.score);
    $('pentaCorrectionScore').value=entry.attempt;
    $('pentaCorrectionModal').hidden=false;
    $('pentaCorrectionScore').focus();
  }
  function saveCorrection(event){
    event.preventDefault();
    if(correctionIndex<0||!state||state.status!=='playing')return;
    const replacement=Number($('pentaCorrectionScore').value);
    if(!E.isScore(replacement)){
      $('pentaCorrectionError').textContent='Ugyldig X01-score.';
      return;
    }
    const original=state.current.entries.slice();
    const idx=correctionIndex;
    let position=-1;
    for(let i=state.undo.length-1;i>=0;i--){
      const record=state.undo[i];
      if(record.stageIndex===state.stageIndex&&record.status==='playing'&&record.current?.entries?.length===idx){
        position=i;break;
      }
    }
    if(position<0){
      $('pentaCorrectionError').textContent='Kastet er ikke lenger i angrehistorikken.';
      return;
    }
    const baseline=JSON.parse(JSON.stringify(state.undo[position]));
    baseline.undo=state.undo.slice(0,position);
    let corrected=baseline;
    try{
      for(let i=idx;i<original.length;i++){
        const entry=original[i];
        corrected=E.submitX01(corrected,{
          score:i===idx?replacement:entry.attempt,
          bust:entry.bust,
          doubleConfirmed:entry.checkout,
          darts:entry.darts
        });
      }
      state=corrected;
      feedback='Kastet er korrigert. X01-score og Pentathlon-poeng er beregnet på nytt.';
      persist();closeCorrection();render();
    }catch(error){
      $('pentaCorrectionError').textContent='Kan ikke bruke denne korrigeringen: '+(error.message||error)+
        '. Senere kast må fortsatt være gyldige. Ingen endringer er lagret.';
    }
  }
  function renderX01Board(){
    const c=state.current,board=$('pentaLocalBoard');
    board.replaceChildren();
    for(let p=0;p<2;p++){
      const card=create('article','local-player'+(c.turn===p?' active':''));
      const top=create('div','local-player-top');
      top.append(create('small','','SPILLER '+(p+1)),create('span','local-current-marker','Kaster nå'));
      const name=create('h2','local-match-name');
      name.appendChild(create('span','',state.players[p]));
      if(c.starter===p){
        const marker=create('span','local-starter-mark','🎯');
        marker.title='Starter leget';
        marker.setAttribute('aria-label','Starter leget');
        name.appendChild(marker);
      }
      const band=create('div','local-score-band');
      const darts=create('div','local-live-darts');
      darts.append(create('b','',c.used[p]),create('span','','PILER'));
      const avg=create('div','local-avg');
      avg.append(create('b','',x01Average(c.entries,p,c.used[p])),create('span','','AVG'));
      band.append(darts,create('div','local-score',c.remaining[p]),avg);
      const extra=create('div','local-leg-label');
      extra.append(create('span','','PENTATHLON +'+c.pent[p]+' · '+(c.starter===p?'STARTER':'')));
      card.append(top,name,band,extra);
      board.appendChild(card);
    }
    $('pentaX01Turn').textContent=state.players[c.turn]+' kaster';
    x01LiveStats();
    const throws=$('pentaX01Throws');
    throws.replaceChildren();
    for(let p=0;p<2;p++){
      const line=create('div','penta-x01-throw-line');
      line.appendChild(create('strong','',state.players[p]));
      const chips=create('div','penta-x01-throw-chips');
      const visits=c.entries.map((entry,index)=>({entry,index}))
        .filter(item=>item.entry.type==='visit'&&item.entry.player===p).slice(-3);
      for(const item of visits){
        const entry=item.entry;
        const chip=create('button','penta-x01-throw-chip',entry.bust?'BUST':entry.score);
        chip.type='button';
        chip.title='Korriger dette kastet';
        chip.addEventListener('click',()=>openCorrection(item.index));
        chips.appendChild(chip);
      }
      if(!visits.length)chips.appendChild(create('span','penta-x01-empty','Ingen kast'));
      line.appendChild(chips);throws.appendChild(line);
    }
  }
  function stageStats(){
    const c=state.current,wrap=$('pentaStagePlayers'),idx=state.stageIndex;
    const x01=c.kind==='x01';
    $('pentaX01Board').hidden=!x01;
    wrap.hidden=x01;
    $('pentaTarget').parentElement.parentElement.hidden=x01;
    if(x01)renderX01Board();
    wrap.replaceChildren();
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
    $('pentaDartControls').hidden=c.kind==='x01';
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
    if(c.kind==='x01')updateCheckoutRow();
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
    const a=state.total[0],b=state.total[1];
    $('pentaWinner').textContent=a===b?'UAVGJORT!':state.players[a>b?0:1]+' VINNER!';
    $('pentaFinishDescription').textContent=state.players[0]+': '+a+' poeng · '+state.players[1]+': '+b+' poeng. Alle 7 øvelser er fullført.';
  }
  function render(){
    if(!state)return;
    $('pentaSetup').hidden=true;$('pentaGame').hidden=false;
    $('pentaStatus').textContent=state.status==='finished'?'PENTATHLON FULLFØRT':
      'ØVELSE '+(state.stageIndex+1)+' AV '+E.STAGES.length;
    $('pentaUndo').disabled=!state.undo?.length;
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
  function updateCheckoutRow(){
    if(!state||state.status!=='playing'||state.current.kind!=='x01')return;
    const amount=Number($('pentaVisit').value),raw=$('pentaVisit').value.trim();
    const show=raw!==''&&!$('pentaBust').checked&&amount===state.current.remaining[state.current.turn];
    $('pentaCheckoutRow').hidden=!show;
    if(!show)$('pentaCheckout').checked=false;
  }
  function submitX01(event){
    event.preventDefault();
    if(state?.status!=='playing'||state.current.kind!=='x01')return;
    try{
      const score=$('pentaVisit').value.trim();
      const oldStage=state.stageIndex;
      const remaining=state.current.remaining[state.current.turn];
      const shouldCheckout=score!==''&&!$('pentaBust').checked&&Number(score)===remaining;
      if(shouldCheckout&&!$('pentaCheckout').checked){
        feedback='Bekreft dobbel-ut og velg antall piler for utsjekken.';
        $('pentaCheckoutRow').hidden=false;
        $('pentaCheckout').focus();
        $('pentaFeedback').textContent=feedback;
        return;
      }
      state=E.submitX01(state,{
        score,bust:$('pentaBust').checked,doubleConfirmed:$('pentaCheckout').checked,
        darts:Number($('pentaCheckoutDarts').value)
      });
      feedback=state.status==='review'?'Øvelsen er avsluttet!':
        'Registrert '+score+'. '+state.players[state.current.turn]+' kaster nå.';
      $('pentaFeedback').style.borderColor='';
      $('pentaVisit').value='';$('pentaBust').checked=false;$('pentaCheckout').checked=false;
      persist();render();
      if(state.status==='review')$('pentaReviewPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(error){report(error)}
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
      feedback=state.players[starter]+' starter første 501-leg.';
      persist();render();
      $('pentaGame').scrollIntoView({block:'start',behavior:'smooth'});
    }catch(error){
      $('pentaSetupError').textContent=error.message||String(error);
    }finally{
      starting=false;
      button.disabled=false;
      resumeButton.disabled=false;
    }
  }
  function resume(){const saved=stored();if(!saved)return;state=saved;feedback='Femkampen er gjenopptatt.';render()}
  function undo(){
    if(!state)return;
    try{state=E.undo(state);feedback='Forrige registrering angret.';persist();render()}
    catch(error){report(error)}
  }
  function reset(){
    if(state&&!window.confirm('Starte en ny Pentathlon? Nåværende resultat og angrehistorikk overskrives.'))return;
    state=null;
    try{localStorage.removeItem(STORE)}catch(_){}
    $('pentaGame').hidden=true;$('pentaSetup').hidden=false;showResume();
    $('pentaSetup').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function nextStage(){
    if(state?.status!=='review')return;
    try{
      state=E.nextStage(state);
      feedback='Neste øvelse er klar. '+state.players[state.current.turn]+' starter.';
      persist();render();
      $('pentaGame').scrollIntoView({block:'start',behavior:'smooth'});
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
  $('pentaStart').addEventListener('click',start);
  $('pentaResume').addEventListener('click',resume);
  $('pentaReset').addEventListener('click',reset);
  $('pentaUndo').addEventListener('click',undo);
  $('pentaNextStage').addEventListener('click',nextStage);
  $('pentaExport').addEventListener('click',exportCsv);
  $('pentaX01Form').addEventListener('submit',submitX01);
  $('pentaVisit').addEventListener('input',updateCheckoutRow);
  $('pentaBust').addEventListener('change',updateCheckoutRow);
  $('pentaCorrectionForm').addEventListener('submit',saveCorrection);
  $('pentaCorrectionCancel').addEventListener('click',closeCorrection);
  $('pentaCorrectionModal').querySelector('.penta-correction-backdrop').addEventListener('click',closeCorrection);
  $('pentaBustButton').addEventListener('click',()=>{
    if(state?.status!=='playing'||state.current.kind!=='x01')return;
    $('pentaBust').checked=true;
    $('pentaVisit').value='0';
    $('pentaX01Form').requestSubmit();
  });
  $('pentaMobileKeypad').addEventListener('click',event=>{
    const key=event.target.closest('button');
    if(!key)return;
    const input=$('pentaVisit');
    if(key.dataset.pentaKey!==undefined){
      input.value=(input.value+key.dataset.pentaKey).slice(0,3);
      updateCheckoutRow();
    }else if(key.dataset.pentaAction==='delete'){
      input.value=input.value.slice(0,-1);updateCheckoutRow();
    }else if(key.dataset.pentaAction==='enter'){
      $('pentaX01Form').requestSubmit();
    }
  });
  course();makeNumberGrid();renderMultiplier();showResume();
})();
