/* Local Head-to-Head UI. No camera, Supabase or remote calls. */
(function(){
'use strict';
const E=window.DartArenaLocalH2HEngine;
const B=window.DartArenaBotEngine;
const tournamentFixture=new URLSearchParams(location.search).get('tournamentAiMatch');
const requestedX01=Number(new URLSearchParams(location.search).get('format'))||501;
const rivalStorageFormat=[170,301,501,1001].includes(requestedX01)?requestedX01:501;
const BOT_SESSION_KEY=tournamentFixture?'dartarena-ai-rival-tournament-bot-session-'+tournamentFixture:rivalStorageFormat===501?'dartarena-ai-rival-501-bot-session-v1':'dartarena-ai-rival-'+rivalStorageFormat+'-bot-session-v1';
const ADAPT_KEY='dartarena-bot-adaptive-v1';
const BOT_PERSONAS={
  steady:['Clockwork','The Metronome','Iron Mike'],
  erratic:['Wildcard','Chaos Engine','Boom or Bust'],
  scorer:['Triple Threat','Maximum Max','T20 Titan'],
  finisher:['The Closer','Double Trouble','Deadeye'],
  adaptive:['Nemesis','Chameleon','Evolver']
};
const $=id=>document.getElementById(id);
if(!E||!$('localSetupForm'))return;
const KEY=tournamentFixture?'dartarena-ai-rival-tournament-state-'+tournamentFixture:rivalStorageFormat===501?'dartarena-ai-rival-501-state-v1':'dartarena-ai-rival-'+rivalStorageFormat+'-state-v1';
let state=null,pendingCheckout=null,editingIndex=null,betweenTimer=null,botTimer=null,coinBusy=false,
  botConfig=null,botRecorded=false,message='Skriv score og trykk Enter.',isError=false;
const ui={
  setup:$('localSetup'),setupForm:$('localSetupForm'),setupError:$('localSetupError'),
  name1:$('localName1'),name2:$('localName2'),format:$('localFormat'),bestOf:$('localBestOf'),
  opponentType:$('localOpponentType'),opponentField:$('localHumanOpponentField'),opponentLabel:$('localOpponentCardLabel'),
  botSettings:$('localBotSettings'),botMode:$('localBotMode'),botAverage:$('localBotAverage'),
  botProfile:$('localBotProfile'),botName:$('localBotName'),botHint:$('localBotHint'),
  mode:$('localMode'),setsField:$('localSetsField'),bestOfSets:$('localBestOfSets'),starter:$('localStarter'),
  game:$('localGame'),scoreForm:$('localScoreForm'),score:$('localScoreInput'),
  keypad:$('localMobileKeypad'),statsOpen:$('localStatsOpen'),statsClose:$('localStatsClose'),
  statsPanel:$('localStatsPanel'),statsBackdrop:$('localStatsBackdrop'),
  submit:$('localSubmit'),bust:$('localBust'),turn:$('localTurn'),
  between:$('localBetween'),finished:$('localFinished'),checkout:$('localCheckout'),
  checkoutForm:$('localCheckoutForm'),checkoutDarts:$('localCheckoutDarts'),checkoutTitle:$('localCheckoutTitle'),
  checkoutText:$('localCheckoutText'),checkoutChoices:$('localCheckoutChoices'),history:$('localHistory'),message:$('localMessage'),
  correction:$('localCorrectionModal'),correctionForm:$('localCorrectionForm'),
  correctionScore:$('localCorrectionScore'),correctionTitle:$('localCorrectionTitle'),
  correctionContext:$('localCorrectionContext'),correctionError:$('localCorrectionError'),
  correctionCheckout:$('localCorrectionCheckout'),correctionDarts:$('localCorrectionDarts')
};
window.DartArenaLocalNameHistory?.attach(['localName1','localName2']);
const doubleInLabel=document.createElement('label');
doubleInLabel.className='field ai-rival-double-in';
doubleInLabel.style.cssText='display:flex;gap:9px;align-items:center;margin:10px 0';
doubleInLabel.innerHTML='<input id="aiRivalDoubleIn" type="checkbox"> Første tellende pil traff dobbel (DOUBLE IN)';
ui.scoreForm.prepend(doubleInLabel);
const doubleInCheck=$('aiRivalDoubleIn');
function showMessage(text,error=false){message=text;isError=error;ui.message.textContent=text;ui.message.classList.toggle('is-error',error)}
function safeSave(){
  try{
    if(state)localStorage.setItem(KEY,JSON.stringify(state));else localStorage.removeItem(KEY);
    if(state&&botConfig)localStorage.setItem(BOT_SESSION_KEY,JSON.stringify({id:state.id,config:botConfig,recorded:botRecorded}));
    else localStorage.removeItem(BOT_SESSION_KEY);
    // Persist a finished game before rendering the result screen.
    if(state?.status==='finished')null /* AI Rival training must not modify local head-to-head history */;
  }catch{showMessage('Kampen kjører, men kunne ikke lagres i denne nettleseren.',true)}
  window.dispatchEvent(new Event('dartarena:practice-save'));
}
function readAdaptive(){
  try{
    const data=JSON.parse(localStorage.getItem(ADAPT_KEY)||'null');
    return {level:Math.max(20,Math.min(120,Number(data?.level)||55)),games:Math.max(0,Number(data?.games)||0)};
  }catch{return {level:55,games:0}}
}
let botNameContext=null;
function updateBotNames(){
  const context=ui.botMode.value==='adaptive'?'adaptive':ui.botProfile.value;
  const names=BOT_PERSONAS[context]||BOT_PERSONAS.steady;
  if(context===botNameContext&&ui.botName.options.length===names.length)return;
  const previous=ui.botName.value;
  const savedName=botConfig?.mode===ui.botMode.value&&
    (botConfig.mode==='adaptive'||botConfig.profile===ui.botProfile.value)
      ?botConfig.name:null;
  ui.botName.replaceChildren();
  for(const name of names){
    const option=document.createElement('option');
    option.value=name;
    option.textContent=name;
    ui.botName.appendChild(option);
  }
  ui.botName.value=names.includes(previous)?previous:
    names.includes(savedName)?savedName:names[0];
  botNameContext=context;
}
function updateBotFields(){
  const selected=ui.opponentType.value==='bot';
  ui.opponentField.hidden=selected;ui.name2.disabled=selected;ui.name2.required=!selected;
  ui.botSettings.hidden=!selected;
  for(const element of [ui.botMode,ui.botAverage,ui.botProfile,ui.botName])element.disabled=!selected;
  ui.starter.options[1].textContent=selected?'Bot':'Spiller 2';
  if(!selected)return;
  updateBotNames();
  const adaptive=readAdaptive();
  ui.botHint.textContent=ui.botMode.value==='adaptive'
    ?adaptive.games?'Adaptive AI: nivå '+adaptive.level.toFixed(1)+' etter '+adaptive.games+' kamper. Justeres mellom kampene. Botnavnet endrer ikke styrken.':
      'Adaptive AI starter på valgt nivå og lærer mellom fullførte kamper. Botnavnet endrer ikke styrken.'
    :'Standard: valgt snitt er et langsiktig mål. Velg et botnavn for spillestilen.';
}
ui.opponentType.addEventListener('change',updateBotFields);
ui.botMode.addEventListener('change',updateBotFields);
ui.botProfile.addEventListener('change',updateBotFields);
const mobileMatch=window.matchMedia('(max-width: 700px)');
function isMobileView(){return mobileMatch.matches}
function canEnterHumanScore(){
  return state?.status==='playing'&&(!botConfig||state.turn===0)&&!pendingCheckout&&
    editingIndex===null&&ui.checkout.hidden&&ui.correction.hidden;
}
function focusScore(){
  if(isMobileView()||!canEnterHumanScore())return;
  const id=state.id;
  // A click on Registrer can change focus after submit; restore it after the event.
  setTimeout(()=>{
    if(!state||state.id!==id||!canEnterHumanScore()||ui.scoreForm.hidden)return;
    ui.score.focus({preventScroll:true});ui.score.select();
  },0);
}
function closeStats(){
  document.body.classList.remove('local-stats-open');
  ui.statsBackdrop.hidden=true;
  ui.statsPanel.removeAttribute('role');
  ui.statsPanel.removeAttribute('aria-modal');
  ui.statsOpen.setAttribute('aria-expanded','false');
  if(isMobileView())ui.statsOpen.focus({preventScroll:true});
}
function openStats(){
  if(!state||!isMobileView()||!ui.checkout.hidden||!ui.correction.hidden)return;
  document.body.classList.add('local-stats-open');
  ui.statsBackdrop.hidden=false;
  ui.statsPanel.setAttribute('role','dialog');
  ui.statsPanel.setAttribute('aria-modal','true');
  ui.statsOpen.setAttribute('aria-expanded','true');
  ui.statsClose.focus({preventScroll:true});
}
function syncMobileControls(){
  // Keep PC keyboard-first behavior; suppress the system keyboard only in the
  // narrow layout where the in-page keypad is visible.
  ui.score.readOnly=isMobileView();
  ui.score.setAttribute('inputmode',isMobileView()?'none':'numeric');
  if(!isMobileView()&&document.body.classList.contains('local-stats-open'))closeStats();
}
ui.statsOpen.addEventListener('click',openStats);
ui.statsClose.addEventListener('click',closeStats);
ui.statsBackdrop.addEventListener('click',closeStats);
mobileMatch.addEventListener('change',syncMobileControls);
syncMobileControls();
ui.keypad.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||!state||state.status!=='playing'||pendingCheckout||editingIndex!==null||
     !ui.checkout.hidden||!ui.correction.hidden)return;
  const digit=button.dataset.keypadDigit,action=button.dataset.keypadAction;
  if(digit!==undefined){
    if(ui.score.value.length>=3)return;
    ui.score.value+=digit;
    showMessage('Score: '+ui.score.value);
  }else if(action==='delete'){
    ui.score.value=ui.score.value.slice(0,-1);
    showMessage(ui.score.value?'Score: '+ui.score.value:'Skriv score og trykk Enter.');
  }else if(action==='enter'){
    ui.scoreForm.requestSubmit();
  }
});
function player(i){return state.players[i]}
function cancelBot(){if(botTimer!==null){clearTimeout(botTimer);botTimer=null}}
function scheduleBot(){
  if(!window.DartArenaRivalProfile||botTimer!==null||!botConfig||!B||state?.status!=='playing'||state.turn!==1||
    pendingCheckout||editingIndex!==null)return;
  const id=state.id,set=state.currentSet,leg=state.leg,remaining=state.scores[1];
  botTimer=setTimeout(()=>{
    botTimer=null;
    if(!state||state.id!==id||state.status!=='playing'||state.turn!==1||
      state.currentSet!==set||state.leg!==leg||state.scores[1]!==remaining||
      pendingCheckout||editingIndex!==null)return;
    try{
      const outcome=B.visit(remaining,{...botConfig,doubleInPending:state.doubleIn===true&&state.entered?.[1]!==true});
      const updated=E.submit(state,outcome.score,{bust:outcome.bust,doubleConfirmed:outcome.checkout,darts:outcome.darts,doubleInConfirmed:outcome.doubleInConfirmed===true});
      const visit=updated.visits[updated.visits.length-1];visit.dartDetails=outcome.throws;
      state=updated;
      showMessage(visit.bust?'Bot: BUST.':visit.checkout?'Bot sjekket ut '+visit.score+' med '+visit.darts+' piler.':'Bot scoret '+visit.score+' poeng.');
      safeSave();render();
    }catch(err){showMessage('Botfeil: '+(err?.message||String(err)),true)}
  },700);
}
function recordAdaptiveMatch(){
  if(!botConfig||botRecorded||state?.status!=='finished')return;
  botRecorded=true;
  if(botConfig.mode==='adaptive'){
    const saved=readAdaptive(),actual=E.stats(state,0).average;
    if(actual>0){
      try{localStorage.setItem(ADAPT_KEY,JSON.stringify({level:B.nextAdaptive(botConfig.average,actual),games:saved.games+1}))}catch{}
    }
  }
  safeSave();
}
function scheduleBetween(){
  clearTimeout(betweenTimer);betweenTimer=null;
  if(state?.status!=='between')return;
  // Advance automatically after a brief result transition, without clicking.
  const matchId=state.id,leg=state.leg,setNo=state.currentSet;
  betweenTimer=setTimeout(()=>{
    betweenTimer=null;
    if(state?.status!=='between'||state.id!==matchId||state.leg!==leg||state.currentSet!==setNo)return;
    commit(()=>E.nextLeg(state),'Neste '+(state.betweenType==='set'?'sett':'leg')+' startet.');
  },1200);
}
function updateSetsField(){ui.setsField.hidden=ui.mode.value!=='sets';}
ui.mode.addEventListener('change',updateSetsField);
updateSetsField();
function statValue(id,value){$(id).textContent=String(value)}
function render(){
  ui.setup.hidden=!!state;ui.game.hidden=!state;
  document.body.classList.toggle('local-match-active',!!state);
  document.body.classList.toggle('local-match-finished',state?.status==='finished');
  if(!state){window.DartArenaLocalResults?.syncX01(null,newMatch);return;}
  ui.opponentLabel.textContent=botConfig?'BOT':'SPILLER 2';
  statValue('localFormatLabel',state.doubleIn?'301 DI/DO':state.format);
  $('localSetLabel').hidden=state.mode!=='sets';
  statValue('localSetLabel','Set '+state.currentSet);
  statValue('localLegLabel','Leg '+state.leg);
  statValue('localBestLabel',state.mode==='sets'?'Best av '+state.bestOfSets+' sets · '+state.bestOf+' legs':'Best av '+state.bestOf+' legs');
  $('localUndo').disabled=!state.undo?.length;
  // Reuse the exact X01 statistics calculation from online Head-to-Head.
  // Local visits are adapted in memory; nothing is uploaded to Supabase.
  const onlineThrows=state.visits.map(v=>({
    player_id:v.player,score:v.score,is_checkout:v.checkout,
    darts_used:v.darts,set_no:v.set||1,leg_no:v.leg
  }));
  for(let i=0;i<2;i++){
    const st=window.DartArenaX01Stats.statsFor(onlineThrows,i);
    const active=state.status==='playing'&&state.turn===i;
    const card=$('localPlayer'+i);
    // Online X01 puts the original match starter in the left player card.
    card.style.order=i===state.firstStarter?0:1;
    card.classList.toggle('active',active);
    card.classList.toggle('winner',state.status==='finished'&&state.winner===i);
    statValue('localPlayerName'+i,player(i));
    statValue('localScore'+i,state.scores[i]);
    statValue('localLegs'+i,state.legs[i]);
    $('localSetsWrap'+i).hidden=state.mode!=='sets';
    statValue('localSets'+i,state.sets[i]);
    $('localStarterMarker'+i).hidden=state.status!=='playing'||state.starter!==i;
    // Match the online live-darts counter: current leg only, 3 darts per
    // ordinary visit and the actual number used for a winning checkout.
    const currentLegDarts=onlineThrows.filter(v=>v.player_id===i&&v.set_no===state.currentSet&&v.leg_no===state.leg)
      .reduce((sum,v)=>sum+window.DartArenaX01Stats.dartsFor(v),0);
    statValue('localDarts'+i,currentLegDarts);
    statValue('localAverage'+i,onlineThrows.some(v=>v.player_id===i)?st.avg.toFixed(2):'–');
    statValue('localStatsName'+i,player(i));
    statValue('localStatsName'+i+'b',player(i));
    statValue('localStatAvg'+i,st.avg.toFixed(2));
    statValue('localStatFirst9'+i,st.first9.toFixed(2));
    statValue('localStatCheckout'+i,st.high||'–');
    statValue('localStatFastest'+i,st.fast?st.fast+' piler':'–');
    statValue('localStat100'+i,st.c100);
    statValue('localStat140'+i,st.c140);
    statValue('localStat170'+i,st.c170);
    statValue('localStat180'+i,st.c180);
  }
  const playing=state.status==='playing';
  const humanTurn=playing&&(!botConfig||state.turn===0);
  const needsDoubleIn=humanTurn&&state.doubleIn===true&&state.entered?.[state.turn]!==true;
  doubleInLabel.hidden=!needsDoubleIn;
  doubleInLabel.style.display=needsDoubleIn?'flex':'none';
  ui.scoreForm.hidden=!humanTurn;ui.keypad.hidden=!humanTurn;
  ui.bust.disabled=!humanTurn;ui.submit.disabled=!humanTurn;ui.score.disabled=!humanTurn;
  ui.between.hidden=state.status!=='between';ui.finished.hidden=state.status!=='finished';
  if(playing)ui.turn.textContent=player(state.turn)+(botConfig&&state.turn===1?' tenker…':' kaster')+' · '+state.scores[state.turn]+' igjen';
  else if(state.status==='between'){
    const last=state.visits[state.visits.length-1];
    ui.turn.textContent='Leg '+state.leg+' ferdig';
    const setWon=state.betweenType==='set';
    statValue('localBetweenTitle',player(last.player)+' vant '+(setWon?'sett '+state.currentSet:'leg '+state.leg));
    const nextStarter=E.legStarter(state,setWon?state.currentSet+1:state.currentSet,setWon?1:state.leg+1);
    statValue('localBetweenText',player(nextStarter)+' starter neste '+(setWon?'sett':'leg')+'.');
    $('localNextLeg').textContent='Start neste '+(setWon?'sett':'leg');
  }else{
    ui.turn.textContent='Kampen er ferdig';
    statValue('localWinnerText',player(state.winner)+' vant!');
    statValue('localFinalText',state.mode==='sets'?(state.sets[0]+' – '+state.sets[1]+' i sets · '+state.format+' · best av '+state.bestOfSets+' sets'):(state.legs[0]+' – '+state.legs[1]+' i legs · '+state.format+' · best av '+state.bestOf));
  }
  showMessage(message,isError);
  scheduleBetween();
  renderCorrections();
  ui.history.replaceChildren();
  if(!state.visits.length){
    const empty=document.createElement('p');
    empty.className='muted compact';empty.textContent='Ingen kast registrert ennå.';
    ui.history.append(empty);
  }else{
    for(const visit of state.visits.slice(-14).reverse()){
      const row=document.createElement('div');row.className='local-history-row';
      const title=document.createElement('strong'),score=document.createElement('strong'),detail=document.createElement('span');
      title.textContent=player(visit.player);
      score.textContent=visit.bust?'BUST':visit.score+' poeng';
      detail.textContent='Leg '+visit.leg+' · '+(visit.checkout?'Utsjekk med '+visit.darts+' pil'+(visit.darts!==1?'er':''):visit.remaining+' igjen');
      if(botConfig&&visit.player===1&&Array.isArray(visit.dartDetails))detail.textContent+=' · '+visit.dartDetails.map(d=>d.hit).join(' + ');
      row.append(title,score,detail);ui.history.append(row);
    }
  }
  if(state.status==='finished'){
    cancelBot();recordAdaptiveMatch();
    // Idempotent history writer: repeated renders and reloading must not duplicate a match.
    try{
      const result=null /* AI Rival training must not modify local head-to-head history */;
      if(!window.DartArenaH2HHistory||result?.reason==='storage')
        showMessage('Kampen er ferdig, men historikken kunne ikke lagres her. Oppdater siden.',true);
    }catch(error){
      console.warn('Kunne ikke arkivere lokal Head-to-Head-kamp',error);
      showMessage('Kampen er ferdig, men historikken kunne ikke lagres her. Oppdater siden.',true);
    }
    if(document.body.classList.contains('local-stats-open'))closeStats();
  }
  window.DartArenaLocalResults?.syncX01(state,newMatch);
  if(humanTurn)focusScore();
  else if(playing)scheduleBot();
}
function renderCorrections(){
  if(!state)return;
  const active=state.status==='playing';
  for(let playerIndex=0;playerIndex<2;playerIndex++){
    const host=$('localThrows'+playerIndex);
    const name=$('localThrowsName'+playerIndex);
    name.textContent=state.players[playerIndex];
    host.replaceChildren();
    const recent=state.visits.map((visit,index)=>({visit,index}))
      .filter(({visit})=>visit.player===playerIndex&&visit.leg===state.leg&&(visit.set||1)===state.currentSet)
      .slice(-3);
    const editable=new Set(E.editableIndices(state,playerIndex));
    if(!recent.length){
      const empty=document.createElement('span');
      empty.className='local-throw-empty';empty.textContent='Ingen kast ennå';
      host.appendChild(empty);continue;
    }
    for(const item of recent){
      const isEditable=active&&editable.has(item.index)&&!(botConfig&&playerIndex===1);
      const chip=document.createElement(isEditable?'button':'span');
      chip.className='local-throw-chip'+(isEditable?' editable':'');
      chip.textContent=item.visit.checkout?item.visit.score+' ('+item.visit.darts+'p)':
        item.visit.bust?'BUST':String(item.visit.score);
      if(isEditable){
        chip.type='button';
        chip.title='Korriger score for '+state.players[playerIndex];
        chip.setAttribute('aria-label','Korriger kast '+chip.textContent+' for '+state.players[playerIndex]);
        const icon=document.createElement('span');
        icon.className='local-throw-edit-icon';icon.textContent='✎';icon.setAttribute('aria-hidden','true');
        chip.appendChild(icon);
        chip.addEventListener('click',()=>openCorrection(item.index));
      }
      host.appendChild(chip);
    }
  }
}
function closeCorrection(){
  editingIndex=null;
  ui.correction.hidden=true;
  ui.correctionCheckout.hidden=true;
  ui.correctionError.hidden=true;
  focusScore();
  scheduleBot();
}
function openCorrection(index){
  if(!state||state.status!=='playing')return;
  cancelBot();
  const visit=state.visits[index];
  if(!visit||!E.editableIndices(state,visit.player).includes(index))return;
  editingIndex=index;
  ui.correctionTitle.textContent='Korriger kast';
  ui.correctionContext.textContent=state.players[visit.player]+' · leg '+visit.leg+' · tidligere '+(visit.bust?'BUST':visit.score+' poeng');
  ui.correctionScore.value=String(visit.score);
  ui.correction.hidden=false;
  ui.correctionError.hidden=true;
  updateCorrectionCheckout();
  ui.correctionScore.focus();
}
function updateCorrectionCheckout(){
  ui.correctionCheckout.hidden=true;
  if(editingIndex===null||!state)return;
  const visit=state.visits[editingIndex];
  const previous=state.visits.slice(0,editingIndex).filter(v=>v.player===visit.player&&v.leg===visit.leg&&(v.set||1)===(visit.set||1));
  const remainingBefore=previous.length?previous[previous.length-1].remaining:state.format;
  const value=Number(ui.correctionScore.value);
  if(ui.correctionScore.value.trim()===''||!Number.isInteger(value)||value!==remainingBefore)return;
  const valid=E.checkoutOptions(value);
  if(!valid.length||editingIndex!==state.visits.length-1)return;
  const select=ui.correctionDarts;select.replaceChildren();
  for(const dartCount of valid){
    const option=document.createElement('option');option.value=String(dartCount);
    option.textContent=dartCount+' pil'+(dartCount===1?'':'er');select.appendChild(option);
  }
  select.value=String(valid[valid.length-1]);
  ui.correctionCheckout.hidden=false;
}
function commit(fn,msg){
  cancelBot();
  try{
    state=fn();
    pendingCheckout=null;
    ui.checkout.hidden=true;
    editingIndex=null;
    ui.correction.hidden=true;
    ui.score.value='';doubleInCheck.checked=false;
    showMessage(msg||'Score registrert.');
    safeSave();render();
  }catch(e){showMessage(e?.message||'Ugyldig registrering.',true)}
}
function closeCheckout(){
  pendingCheckout=null;
  ui.checkout.hidden=true;
  focusScore();
}
function openCheckout(score){
  const available=E.checkoutOptions(score);
  if(!available.length){
    showMessage('Dette er ikke en mulig utsjekk. Bruk BUST hvis turen ble ugyldig.',true);
    return;
  }
  pendingCheckout={score,player:state.turn};
  ui.checkoutTitle.textContent='Utsjekk: '+score+' poeng';
  ui.checkoutText.textContent=player(state.turn)+': bekreft at siste pil traff en dobbel.';
  ui.checkoutDarts.replaceChildren();
  ui.checkoutChoices.replaceChildren();
  for(const darts of available){
    const option=document.createElement('option');
    option.value=String(darts);
    option.textContent=darts+' pil'+(darts===1?'':'er');
    ui.checkoutDarts.appendChild(option);
    const button=document.createElement('button');button.type='button';
    button.textContent=String(darts);button.className='primary';
    button.title=darts+' '+(darts===1?'pil':'piler');
    button.addEventListener('click',()=>finishCheckoutDarts(darts));
    ui.checkoutChoices.appendChild(button);
  }
  ui.checkoutDarts.value=String(available[available.length-1]);
  ui.checkout.hidden=false;ui.checkoutDarts.focus();
}
function finishCheckoutDarts(darts){
  if(!pendingCheckout||!E.checkoutOptions(pendingCheckout.score).includes(darts))return;
  ui.checkoutDarts.value=String(darts);
  ui.checkoutForm.requestSubmit();
}
document.addEventListener('keydown',event=>{
  if(ui.checkout.hidden||!['1','2','3'].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();
  finishCheckoutDarts(Number(event.key));
},true);
ui.setupForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(coinBusy)return;
  try{
    const useCoin=ui.starter.value==='coin';
    if(useCoin&&!window.DartArenaLocalCoin)throw Error('Myntkastet er ikke tilgjengelig. Oppdater siden.');
    const starter=useCoin?window.DartArenaLocalCoin.winner():Number(ui.starter.value);
    if(![0,1].includes(starter))throw Error('Velg hvem som starter første leg.');
    const selectedBot=ui.opponentType.value==='bot';
    const profile=ui.botProfile.value,botMode=ui.botMode.value,level=Number(ui.botAverage.value);
    if(selectedBot&&(!B||!B.profiles.includes(profile)||!['standard','adaptive'].includes(botMode)||
      !Number.isInteger(level)||level<20||level>120))throw Error('Velg botnivå 20–120 og en gyldig spillestil.');
    const adaptive=readAdaptive();
    const selectedLevel=selectedBot&&botMode==='adaptive'&&adaptive.games?adaptive.level:level;
    const context=botMode==='adaptive'?'adaptive':profile;
    const persona=ui.botName.value;
    if(selectedBot&&!BOT_PERSONAS[context]?.includes(persona))throw Error('Velg et botnavn fra listen.');
    const opponent=selectedBot&&window.DartArenaRivalProfile?window.DartArenaRivalProfile.name+' AI':selectedBot?persona+' BOT ('+Math.round(selectedLevel)+')':ui.name2.value;
    const created=E.setup({name1:ui.name1.value,name2:opponent,
      format:ui.format.value,mode:ui.mode.value,bestOf:ui.bestOf.value,
      bestOfSets:ui.bestOfSets.value,starter,
      doubleIn:Number(ui.format.value)===301});
    let coinAnimationFailed=false;
    if(useCoin){
      coinBusy=true;
      const startButton=ui.setupForm.querySelector('button[type="submit"]');
      if(startButton)startButton.disabled=true;
      try{
        const result=await window.DartArenaLocalCoin.animate(created.players,starter);
        coinAnimationFailed=result.animationFailed;
      }finally{
        coinBusy=false;
        if(startButton)startButton.disabled=false;
      }
    }
    cancelBot();
    state=created;botRecorded=false;
    if(tournamentFixture&&selectedBot){
      try{localStorage.setItem('dartarena-ai-rival-tournament-session',JSON.stringify({fixtureId:tournamentFixture,stateId:created.id}))}catch{}
    }
    botConfig=selectedBot?{mode:botMode,profile,name:persona,average:selectedLevel,format:state.format,
      sigma:B.calibrate(selectedLevel,profile,state.format)}:null;
    window.DartArenaLocalNameHistory?.remember(selectedBot?[state.players[0]]:state.players);
    ui.setupError.hidden=true;
    message=(useCoin?(coinAnimationFailed?'Myntkast trukket, men animasjonen kunne ikke vises. ':''):'')+
      created.players[starter]+' starter første leg.';
    isError=false;
    safeSave();render();
  }catch(e){ui.setupError.textContent=e.message;ui.setupError.hidden=false}
});
ui.scoreForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!state||state.status!=='playing'||pendingCheckout||(botConfig&&state.turn===1))return;
  const raw=ui.score.value.trim();
  if(!raw){showMessage('Skriv en score fra 0 til 180.',true);return}
  const value=Number(raw);
  if(!Number.isInteger(value)||value<0||value>180){showMessage('Scoren må være fra 0 til 180.',true);return}
  if(state.doubleIn&&!state.entered[state.turn]&&value>0&&!doubleInCheck.checked){showMessage('301 Double In: Kryss av for treff på dobbel, eller registrer 0.',true);return}
  if(value===state.scores[state.turn]){openCheckout(value);return}
  const p=state.turn,old=state.scores[p];
  const isBust=value>old||old-value===1;
  commit(()=>E.submit(state,value,{doubleInConfirmed:doubleInCheck.checked}),isBust?'BUST – '+player(p)+' beholder '+old+'.':'Registrert: '+value+' poeng.');
});
// Keyboard-first scoring: after a mouse click elsewhere, the first digit
// redirects typing to the score field. Enter then submits the same form.
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||
      event.isComposing||!state||state.status!=='playing'||
      pendingCheckout||editingIndex!==null||!ui.checkout.hidden||!ui.correction.hidden||
      (botConfig&&state.turn===1))return;
  const target=event.target;
  if(target===ui.score)return;
  if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
  if(event.key>='0'&&event.key<='9'&&event.key.length===1){
    event.preventDefault();
    ui.score.value=event.key;
    ui.score.focus({preventScroll:true});
    ui.score.setSelectionRange(ui.score.value.length,ui.score.value.length);
  }
});
$('localBust').addEventListener('click',()=>{
  if(!state||state.status!=='playing'||(botConfig&&state.turn===1))return;
  const name=player(state.turn);
  commit(()=>E.bust(state),'BUST for '+name+'.');
});

ui.correctionScore.addEventListener('input',()=>{ui.correctionError.hidden=true;updateCorrectionCheckout()});
ui.correctionForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!state||editingIndex===null)return;
  const index=editingIndex,score=ui.correctionScore.value.trim();
  const darts=ui.correctionCheckout.hidden?null:Number(ui.correctionDarts.value);
  try{
    cancelBot();
    const next=E.correctVisit(state,index,score,darts);
    state=next;
    editingIndex=null;ui.correction.hidden=true;
    ui.score.value='';
    showMessage('Kast korrigert til '+score+' poeng.');
    safeSave();render();
  }catch(e){
    ui.correctionError.textContent=e?.message||'Korrigeringen kunne ikke lagres.';
    ui.correctionError.hidden=false;
  }
});
$('localCorrectionCancel').addEventListener('click',closeCorrection);
$('localUndo').addEventListener('click',()=>{
  if(!state?.undo?.length)return;
  commit(()=>E.undo(state),'Siste registrering angret.');
});
$('localNextLeg').addEventListener('click',()=>commit(()=>E.nextLeg(state),'Neste leg startet.'));
ui.checkoutForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!pendingCheckout||!state||state.turn!==pendingCheckout.player)return closeCheckout();
  const score=pendingCheckout.score,darts=Number(ui.checkoutDarts.value),name=player(state.turn);
  commit(()=>E.submit(state,score,{doubleConfirmed:true,darts,doubleInConfirmed:doubleInCheck.checked}),name+' sjekket ut '+score+' med '+darts+' pil'+(darts===1?'':'er')+'.');
});
$('localCheckoutCancel').addEventListener('click',closeCheckout);
$('localCheckoutBust').addEventListener('click',()=>{
  if(!pendingCheckout||!state)return closeCheckout();
  const score=pendingCheckout.score,name=player(state.turn);
  commit(()=>E.submit(state,score,{bust:true}),'BUST for '+name+'.');
});
function navigateToRival(){
  clearTimeout(betweenTimer);betweenTimer=null;
  cancelBot();
  closeStats();
  // Finished games remain in Supabase. Do not restore the previous active game.
  try{localStorage.removeItem(KEY);localStorage.removeItem(BOT_SESSION_KEY)}catch{}
  location.assign('./ai-rival.html');
}
function newMatch(){
  if(!state||state.status==='finished'){navigateToRival();return}
  const dialog=$('aiRivalNewMatchDialog');
  if(!dialog){showMessage('Kunne ikke åpne bekreftelse for ny kamp. Oppdater siden.',true);return}
  dialog.hidden=false;
  $('aiRivalNewMatchCancel')?.focus();
}
function closeNewMatchDialog(){
  const dialog=$('aiRivalNewMatchDialog');
  if(dialog)dialog.hidden=true;
}
$('aiRivalNewMatchCancel')?.addEventListener('click',closeNewMatchDialog);
$('aiRivalNewMatchConfirm')?.addEventListener('click',navigateToRival);
$('aiRivalNewMatchDialog')?.querySelector('.local-modal-backdrop')?.addEventListener('click',closeNewMatchDialog);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('aiRivalNewMatchDialog')?.hidden){
    event.preventDefault();
    closeNewMatchDialog();
  }
});
$('localNewMatch').addEventListener('click',newMatch);
$('localPlayAgain').addEventListener('click',newMatch);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){
  if(document.body.classList.contains('local-stats-open')){event.preventDefault();closeStats()}
  else if(!ui.correction.hidden){event.preventDefault();closeCorrection()}
  else if(!ui.checkout.hidden){event.preventDefault();closeCheckout()}
}});
const requestedRival=new URLSearchParams(location.search).get('player');
if(requestedRival&&localStorage.getItem('dartarena-ai-rival-501-selected-player')!==requestedRival){
 try{localStorage.removeItem(KEY);localStorage.removeItem(BOT_SESSION_KEY)}catch{}
}
try{state=E.restore(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{state=null}
// A completed game belongs in Supabase history, not in the next game's active view.
// Clear only the finished local snapshot; never discard an unfinished match.
if(state?.status==='finished'){
 state=null;
 try{localStorage.removeItem(KEY);localStorage.removeItem(BOT_SESSION_KEY)}catch{}
}
if(state){
  try{
    const saved=JSON.parse(localStorage.getItem(BOT_SESSION_KEY)||'null');
    if(saved?.id===state.id&&saved.config&&B?.profiles.includes(saved.config.profile)&&
      ['adaptive','standard'].includes(saved.config.mode)&&Number(saved.config.sigma)>0){
      botConfig=saved.config;botRecorded=saved.recorded===true;
      ui.opponentType.value='bot';ui.botMode.value=botConfig.mode;
      ui.botProfile.value=botConfig.profile;ui.botAverage.value=String(Math.round(botConfig.average));
    }
  }catch{}
  window.DartArenaLocalNameHistory?.remember(botConfig?[state.players[0]]:state.players);
  message='Lokal kamp gjenopprettet fra denne nettleseren.';isError=false;
}
if(!state&&/(?:[?&])opponent=bot(?:&|$)/.test(window.location?.search||''))ui.opponentType.value='bot';
updateBotFields();
render();
window.addEventListener('dartarena:rival-ready',()=>{if(state)render()});
})();
