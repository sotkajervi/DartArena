// DartArena pure knockout cup. Keeps random cup draws separate from NDF group-stage seeding.
(()=>{
  const $=id=>document.getElementById(id);
  const tournamentId=new URLSearchParams(location.search).get('id');
  const BEST_OF_OPTIONS=Array.from({length:10},(_,i)=>i*2+3);
  const FORMAT_KEY=`dartarena-pure-cup-format-${tournamentId||''}`;
  let simCup=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function getDialog(){for(let i=0;i<40&&!window.DartArenaDialog;i++)await sleep(50);return window.DartArenaDialog||null}

  function isPureCup(){try{return !!tournament&&tournament.tournament_type==='cup'}catch{return false}}
  function isChicagoTournament(){try{return String(tournament?.cup_game_variant||tournament?.game_variant||'x01').toLowerCase()==='chicago'}catch{return false}}
  function isSimulation(){try{return !!simulation}catch{return false}}
  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function nextPow2(n){let x=1;while(x<n)x*=2;return x}
  function targetWins(best){return Math.floor(Number(best||5)/2)+1}
  function validBestOf(n){n=Number(n);return Number.isInteger(n)&&n>=3&&n<=21&&n%2===1}
  function roundName(round,totalRounds){const players=2**(totalRounds-round+1);if(players===2)return'Finale';if(players===4)return'Semifinale';if(players===8)return'Kvartfinale';if(players===16)return'Åttedelsfinale';if(players===32)return'1/16-finale';return`Runde ${round}`}

  // Requirement for a pure cup: run Fisher-Yates three complete times before assigning bracket slots.
  function shuffle3(list){
    let out=[...list];
    for(let pass=0;pass<3;pass++){
      for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
    }
    return out;
  }

  function cupPlayers(){
    try{
      const source=typeof getParticipants==='function'?getParticipants():members.filter(x=>x.role==='participant');
      return source.map(p=>({id:p.user_id,name:names[p.user_id]||'Spiller'}));
    }catch{return[]}
  }

  // Spread BYEs across first-round matches so no BYE-vs-BYE match is created.
  // Which players receive them is still random because players were shuffled first.
  function distributedSlots(shuffled,size){
    const matchCount=size/2,byeCount=size-shuffled.length,byeMatches=new Set();
    if(byeCount>0){for(let i=0;i<byeCount;i++)byeMatches.add(Math.floor(((i+.5)*matchCount)/byeCount))}
    const slots=[];let p=0;
    for(let match=0;match<matchCount;match++){
      if(byeMatches.has(match)){
        const player=shuffled[p++]||null;
        if(match%2===0)slots.push(player,null);else slots.push(null,player);
      }else slots.push(shuffled[p++]||null,shuffled[p++]||null);
    }
    return slots;
  }

  function defaultFormats(rounds){const out={};for(let r=1;r<=rounds;r++)out[r]=r===rounds?7:5;return out}
  function loadFormats(rounds){
    const out=defaultFormats(rounds);
    try{const saved=JSON.parse(localStorage.getItem(FORMAT_KEY)||'{}');for(let r=1;r<=rounds;r++){const n=Number(saved[r]);if(validBestOf(n))out[r]=n}}catch{}
    return out;
  }
  function saveFormats(){
    const values={};document.querySelectorAll('#pureCupFormatSettings select[data-pure-cup-round]').forEach(s=>values[s.dataset.pureCupRound]=Number(s.value));
    try{localStorage.setItem(FORMAT_KEY,JSON.stringify(values))}catch{}
  }
  function selectedFormats(rounds){
    if(isChicagoTournament())return Object.fromEntries(Array.from({length:rounds},(_,i)=>[i+1,3]));
    const out=loadFormats(rounds);document.querySelectorAll('#pureCupFormatSettings select[data-pure-cup-round]').forEach(s=>{const r=Number(s.dataset.pureCupRound),n=Number(s.value);if(r&&validBestOf(n))out[r]=n});return out;
  }
  function optionHtml(selected){return BEST_OF_OPTIONS.map(n=>`<option value="${n}" ${n===selected?'selected':''}>Bo${n}</option>`).join('')}

  function renderSetup(){
    if(!isPureCup()||!tournament||tournament.status!=='cup_setup'||simCup)return;
    const setup=$('cupSetup'),lobby=$('cupLobby'),btn=$('buildCupBtn'),info=$('cupSetupInfo');if(!setup||!btn||!info)return;
    const players=cupPlayers(),size=players.length>=2?nextPow2(players.length):2,rounds=Math.log2(size),formats=loadFormats(rounds);
    setup.classList.remove('hidden');lobby?.classList.add('hidden');
    btn.disabled=players.length<2;
    btn.textContent=isSimulation()?'Trekk og opprett testcup':'Trekk og opprett cup';
    info.textContent=players.length<2?'Minst to spillere må være med i cupen.':isChicagoTournament()
      ?`${players.length} spillere er klare. Chicago Style spilles 301 DIDO • Cricket • 501 SIDO i hver cupkamp${isSimulation()?' • TESTMODUS':''}.`
      :`${players.length} spillere er klare. Spillerlisten stokkes 3 ganger og fordeles tilfeldig i cupen${isSimulation()?' • TESTMODUS':''}.`;
    $('cupFormatSettings')?.remove();
    let box=$('pureCupFormatSettings');
    if(isChicagoTournament()){box?.remove();return}
    if(!box){box=document.createElement('div');box.id='pureCupFormatSettings';box.style.cssText='margin:10px 0 12px;padding:10px 12px;border:1px solid rgba(0,234,244,.25);border-radius:12px;background:rgba(9,20,22,.72)';btn.insertAdjacentElement('beforebegin',box)}
    box.innerHTML=`<div style="display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap"><div style="min-width:145px;margin-right:2px"><small>REN CUP${isSimulation()?' • TEST':''}</small><div style="font-weight:900;font-size:14px;margin-top:3px">Best of per runde</div></div>${Array.from({length:rounds},(_,i)=>i+1).map(r=>`<label class="field" style="margin:0;min-width:112px;flex:1 1 112px"><span style="display:block;font-size:10px;font-weight:800;margin-bottom:3px">${roundName(r,rounds)}</span><select data-pure-cup-round="${r}" style="margin-top:0;padding:8px 10px">${optionHtml(formats[r])}</select></label>`).join('')}</div>`;
    box.querySelectorAll('select').forEach(s=>s.addEventListener('change',saveFormats));
  }

  function firstRoundObjects(players,size){const shuffled=shuffle3(players),slots=distributedSlots(shuffled,size),out=[];for(let i=0;i<size/2;i++)out.push([slots[i*2],slots[i*2+1]]);return out}

  async function buildRealCup(){
    if(!isPureCup()||isSimulation()||tournament.owner_id!==me)return;
    const players=cupPlayers();if(players.length<2)return alert('Minst to spillere må være med i cupen.');
    const {data:existing,error:existingError}=await db.from('tournament_matches').select('id').eq('tournament_id',tournamentId).eq('stage','cup').limit(1);if(existingError)return alert(existingError.message);if(existing?.length)return alert('Cupen er allerede opprettet.');
    const size=nextPow2(players.length),rounds=Math.log2(size),formats=selectedFormats(rounds),pairs=firstRoundObjects(players,size),rows=[];
    pairs.forEach(([a,b],i)=>rows.push({tournament_id:tournamentId,stage:'cup',round_no:1,match_no:i+1,player1_id:a?.id||null,player2_id:b?.id||null,best_of:formats[1],status:a&&b?'pending':a||b?'wo':'pending',winner_id:a&&!b?a.id:!a&&b?b.id:null,is_wo:!!(a&&!b||!a&&b)}));
    for(let r=2;r<=rounds;r++){const count=size/(2**r);for(let i=0;i<count;i++)rows.push({tournament_id:tournamentId,stage:'cup',round_no:r,match_no:i+1,player1_id:null,player2_id:null,best_of:formats[r],status:'pending',is_wo:false})}
    const btn=$('buildCupBtn');if(btn){btn.disabled=true;btn.textContent='Trekker…'}
    const {error}=await db.from('tournament_matches').insert(rows);if(error){if(btn){btn.disabled=false;btn.textContent='Trekk og opprett cup'}return alert('Kunne ikke opprette cup: '+error.message)}
    const {error:te}=await db.from('tournaments').update({status:'cup',updated_at:new Date().toISOString()}).eq('id',tournamentId).eq('owner_id',me).eq('status','cup_setup');if(te)return alert(te.message);
    $('pureCupFormatSettings')?.remove();
    if(typeof load==='function')await load();
    try{await db.rpc('advance_tournament_cup',{p_tournament_id:tournamentId})}catch{}
    if(typeof window.dartArenaLoadCup==='function')await window.dartArenaLoadCup();
  }

  function makeSimCup(){
    const players=cupPlayers();if(players.length<2)return alert('Minst to spillere må være med i cupen.');
    const size=nextPow2(players.length),totalRounds=Math.log2(size),formats=selectedFormats(totalRounds),pairs=firstRoundObjects(players,size),matches=[];
    pairs.forEach(([a,b],i)=>{const winner=a&&!b?a:!a&&b?b:null;matches.push({id:`pure-c1-${i}`,round:1,index:i,a:a||null,b:b||null,p1:null,p2:null,best:formats[1],winner,status:winner?'finished':'pending',wo:!!winner})});
    for(let r=2;r<=totalRounds;r++){for(let i=0;i<size/(2**r);i++)matches.push({id:`pure-c${r}-${i}`,round:r,index:i,a:null,b:null,p1:null,p2:null,best:formats[r],winner:null,status:'waiting',wo:false})}
    simCup={size,totalRounds,matches};window.dartArenaSimulationViewActive=true;$('pureCupFormatSettings')?.remove();advanceSim();renderSim(true);
  }

  function advanceSim(){
    if(!simCup)return;
    for(let r=1;r<simCup.totalRounds;r++){
      const cur=simCup.matches.filter(m=>m.round===r).sort((a,b)=>a.index-b.index),next=simCup.matches.filter(m=>m.round===r+1).sort((a,b)=>a.index-b.index);
      cur.forEach((m,i)=>{if(!m.winner)return;const t=next[Math.floor(i/2)];if(!t)return;if(i%2===0)t.a=m.winner;else t.b=m.winner;if(t.a&&t.b&&t.status==='waiting')t.status='pending'});
    }
  }
  function simPlayer(p,{bye=false}={}){if(!p)return bye?'<span class="cup-bye">BYE</span>':'<span class="cup-name muted">Venter</span>';return `<span class="cup-name">${esc(p.name)}</span>`}
  function renderSim(scroll=false){
    if(!simCup)return;advanceSim();$('cupSetup')?.classList.add('hidden');$('cupLobby')?.classList.remove('hidden');
    const final=simCup.matches.find(m=>m.round===simCup.totalRounds),done=simCup.matches.filter(m=>m.status==='finished').length;
    $('cupProgress').textContent=final?.winner?`Vinner: ${final.winner.name}`:`${done} / ${simCup.matches.length} cupkamper ferdig • TESTMODUS`;
    let controls=$('cupSimulationControls');if(!controls){controls=document.createElement('div');controls.id='cupSimulationControls';controls.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:12px 0';$('cupBracket')?.insertAdjacentElement('beforebegin',controls)}
    controls.innerHTML='<button id="simulatePureCupBtn" class="primary">Simuler resterende cup</button><button id="resetPureCupBtn" class="outline">Trekk cup på nytt</button><span class="status" style="align-self:center">3× tilfeldig trekning • kun lokal test</span>';
    $('cupBracket').innerHTML=Array.from({length:simCup.totalRounds},(_,i)=>i+1).map(r=>{const rm=simCup.matches.filter(m=>m.round===r).sort((a,b)=>a.index-b.index),bo=rm[0]?.best;return `<div class="cup-round"><div class="cup-round-title">${roundName(r,simCup.totalRounds)} • ${isChicagoTournament()?'Chicago Style':`Bo${bo}`}</div>${rm.map(m=>{const score=m.wo?'WO':m.status==='finished'?`${m.p1}–${m.p2}`:'vs',aBye=m.round===1&&m.wo&&!m.a,bBye=m.round===1&&m.wo&&!m.b;return `<div class="cup-match simulation-cup-match pure-cup-sim-match" role="button" tabindex="0" data-pure-sim-id="${m.id}"><div class="cup-player ${m.winner&&m.a&&m.winner.id===m.a.id?'winner':''}">${simPlayer(m.a,{bye:aBye})}</div><div class="cup-score">${score}</div><div class="cup-player ${m.winner&&m.b&&m.winner.id===m.b.id?'winner':''}">${simPlayer(m.b,{bye:bBye})}</div></div>`}).join('')}</div>`}).join('');
    if(scroll)$('cupLobby')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function editSimMatch(m){
    if(!m||m.wo)return;
    if(!m.a||!m.b)return alert('Kampen venter på spillere fra forrige runde.');
    const win=targetWins(m.best),current=m.status==='finished'?`${m.p1}-${m.p2}`:`${win}-0`;
    const message=`${m.a.name} vs ${m.b.name}\n${roundName(m.round,simCup.totalRounds)} • Best av ${m.best}\n\nSkriv sluttresultat:`;
    const dialog=await getDialog();
    const input=dialog
      ?await dialog.prompt(message,{title:'Testresultat',value:current,inputLabel:'SLUTTRESULTAT',confirmText:'Lagre resultat'})
      :prompt(message,current);
    if(input===null)return;
    const x=input.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);
    if(!x)return alert('Skriv resultat som for eksempel 3-1.');
    const p1=Number(x[1]),p2=Number(x[2]);
    if(!((p1===win&&p2<win)||(p2===win&&p1<win)))return alert(`Ugyldig resultat. I Best av ${m.best} må vinneren ha ${win} legs.`);
    const newWinner=p1>p2?m.a:m.b;
    if(m.winner&&newWinner.id!==m.winner.id&&m.round<simCup.totalRounds){
      const target=simCup.matches.find(t=>t.round===m.round+1&&t.index===Math.floor(m.index/2));
      if(target&&target.status==='finished'&&!target.wo)return alert('Kan ikke bytte vinner fordi neste cupkamp allerede er ferdig.');
    }
    m.p1=p1;m.p2=p2;m.winner=newWinner;m.status='finished';advanceSim();renderSim(false);
  }
  function randomSimResult(m){if(!m||!m.a||!m.b||m.status==='finished')return;const win=targetWins(m.best),loser=Math.floor(Math.random()*win);if(Math.random()<.5){m.p1=win;m.p2=loser;m.winner=m.a}else{m.p1=loser;m.p2=win;m.winner=m.b}m.status='finished'}
  function simulateRest(){if(!simCup)return;for(let r=1;r<=simCup.totalRounds;r++){advanceSim();simCup.matches.filter(m=>m.round===r).forEach(randomSimResult)}advanceSim();renderSim(false)}
  function resetSim(){simCup=null;window.dartArenaSimulationViewActive=false;$('cupSimulationControls')?.remove();$('cupLobby')?.classList.add('hidden');renderSetup();$('cupSetup')?.scrollIntoView({behavior:'smooth',block:'start'})}

  async function refresh(){
    if(!isPureCup())return;
    if(tournament?.status==='cup_setup')renderSetup();
    if(tournament?.status!=='cup_setup')$('pureCupFormatSettings')?.remove();
  }

  document.addEventListener('click',e=>{
    if(!isPureCup())return;
    if(e.target.closest('#buildCupBtn')&&tournament?.status==='cup_setup'){
      e.preventDefault();e.stopImmediatePropagation();if(isSimulation())makeSimCup();else buildRealCup();return;
    }
    const simMatch=e.target.closest('.pure-cup-sim-match');if(simMatch&&simCup){e.preventDefault();e.stopImmediatePropagation();editSimMatch(simCup.matches.find(m=>m.id===simMatch.dataset.pureSimId));return}
    if(e.target.closest('#simulatePureCupBtn')){e.preventDefault();e.stopImmediatePropagation();simulateRest();return}
    if(e.target.closest('#resetPureCupBtn')){e.preventDefault();e.stopImmediatePropagation();resetSim();return}
  },true);

  window.addEventListener('dartarena:tournament-loaded',()=>setTimeout(refresh,0));
  setTimeout(refresh,850);
})();