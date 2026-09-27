// DartArena local tournament simulation. Never writes simulated players, matches or results to Supabase.
(function(){
  const $=id=>document.getElementById(id);
  const escLocal=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let simViewActive=false,simState=null,restoring=false;

  const realLoadGroupLobby=typeof window.loadGroupLobby==='function'?window.loadGroupLobby:null;
  if(realLoadGroupLobby){window.loadGroupLobby=async function(...args){if(simViewActive)return;return realLoadGroupLobby.apply(this,args)}}

  function rr(players){let a=[...players];if(a.length%2)a.push(null);const rounds=[];for(let r=0;r<a.length-1;r++){const games=[];for(let i=0;i<a.length/2;i++){const p1=a[i],p2=a[a.length-1-i];if(p1&&p2)games.push([p1,p2])}rounds.push(games);a=[a[0],a[a.length-1],...a.slice(1,-1)]}return rounds}
  function snapshotGroups(){if(!Array.isArray(drawnGroups))return[];return drawnGroups.map(group=>group.map(player=>({id:player.user_id,name:names[player.user_id]||'Testspiller'})))}
  function targetWins(best){return Math.floor(Number(best||5)/2)+1}
  function nextPow2(n){let x=1;while(x<n)x*=2;return x}

  // Standard seeded bracket order, matching the normal 16-player sheet:
  // 1-16, 9-8, 5-12, 13-4, 3-14, 11-6, 7-10, 15-2.
  function seedOrder(size){let a=[1,2];while(a.length<size){const n=a.length*2,out=[];for(const x of a)out.push(x,n+1-x);a=out}return a.slice(0,size)}
  function seededSlots(q,size){
    const seeded=[...q].sort((a,b)=>a.pos-b.pos||a.group-b.group).map((p,i)=>({...p,seedNo:i+1,seedLabel:`${p.pos}P${p.group}`}));
    const bySeed=new Map(seeded.map(p=>[p.seedNo,p]));
    return seedOrder(size).map(seed=>bySeed.get(seed)||null);
  }
  function roundName(round,totalRounds){const players=2**(totalRounds-round+1);if(players===2)return'Finale';if(players===4)return'Semifinale';if(players===8)return'Kvartfinale';if(players===16)return'Åttedelsfinale';return`Runde ${round}`}

  function buildState(){
    const groups=snapshotGroups();if(!groups.length||groups.some(g=>!g.length))return null;
    const best=Number($('groupBestOf').value||5),adv=$('advanceCount').value,matches=[];
    groups.forEach((players,gi)=>rr(players).forEach((round,ri)=>round.forEach(([a,b],mi)=>matches.push({id:`g${gi}-r${ri}-m${mi}`,group:gi,round:ri,a,b,p1:null,p2:null,status:'pending'}))));
    return{groups,best,adv,matches,cup:null};
  }

  function standings(gi){
    const players=simState.groups[gi],rows=Object.fromEntries(players.map(p=>[p.id,{...p,w:0,lf:0,la:0,d:0}]));
    simState.matches.filter(m=>m.group===gi&&m.status==='finished').forEach(m=>{rows[m.a.id].lf+=m.p1;rows[m.a.id].la+=m.p2;rows[m.b.id].lf+=m.p2;rows[m.b.id].la+=m.p1;if(m.p1>m.p2)rows[m.a.id].w++;else rows[m.b.id].w++});
    Object.values(rows).forEach(x=>x.d=x.lf-x.la);
    return Object.values(rows).sort((a,b)=>b.w-a.w||b.d-a.d||b.lf-a.lf||a.name.localeCompare(b.name,'nb'));
  }

  function ensureControls(){
    let bar=$('simulationControls');if(bar)return bar;
    bar=document.createElement('div');bar.id='simulationControls';bar.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:16px 0';
    bar.innerHTML='<button id="simulateAllMatchesBtn" class="primary">Simuler alle puljekamper</button><button id="resetSimulationBtn" class="outline">Nullstill resultater</button><button id="startCupSimulationBtn" class="primary hidden">Test cup</button><span class="status" style="align-self:center">Testdata lagres ikke</span>';
    $('liveGroups')?.insertAdjacentElement('beforebegin',bar);return bar;
  }

  function renderGroupHtml(){
    return simState.groups.map((players,gi)=>{const table=standings(gi),qualify=simState.adv==='all'?players.length:Math.min(players.length,Number(simState.adv||0)),roundNos=[...new Set(simState.matches.filter(m=>m.group===gi).map(m=>m.round))];return `<div class="group-card simulation-group" data-sim-group="${gi}"><div class="heading"><div><small>PULJE ${gi+1}</small><h2>${players.length} spillere</h2></div><div class="status">Best av ${simState.best}</div></div><table class="standings"><thead><tr><th>#</th><th>Spiller</th><th>V</th><th>+/-</th><th>Legs</th></tr></thead><tbody>${table.map((p,i)=>`<tr class="${i<qualify?'qualify':''}"><td>${i+1}</td><td>${escLocal(p.name)}</td><td>${p.w}</td><td>${p.d>0?'+':''}${p.d}</td><td>${p.lf}</td></tr>`).join('')}</tbody></table>${roundNos.map(r=>`<div class="round-block"><div class="round-title">Runde ${r+1}</div>${simState.matches.filter(m=>m.group===gi&&m.round===r).map(m=>`<div class="match-row simulation-match ${m.status==='finished'?'simulation-finished':''}" role="button" tabindex="0" data-sim-id="${m.id}"><div class="match-players"><strong>${escLocal(m.a.name)}</strong><span class="muted">vs</span><strong>${escLocal(m.b.name)}</strong><span class="match-state">${m.status==='finished'?'Ferdig':'Klar'}</span></div><div class="match-score">${m.status==='finished'?`${m.p1}–${m.p2}`:'vs'}</div></div>`).join('')}</div>`).join('')}</div>`}).join('')
  }

  function qualifiers(){
    const out=[];
    simState.groups.forEach((players,gi)=>{const table=standings(gi),n=simState.adv==='all'?table.length:Math.min(table.length,Number(simState.adv||0));table.slice(0,n).forEach((p,i)=>out.push({...p,group:gi+1,pos:i+1,seedLabel:`${i+1}P${gi+1}`}))});
    return out;
  }

  function buildCup(){
    if(!simState||simState.matches.some(m=>m.status!=='finished'))return alert('Alle puljekampene må være ferdige først.');
    const q=qualifiers();if(q.length<2)return alert('Minst to spillere må gå videre til cup.');
    const size=nextPow2(q.length),totalRounds=Math.log2(size),slots=seededSlots(q,size);
    const cupMatches=[];
    for(let i=0;i<size/2;i++){
      const a=slots[i*2],b=slots[i*2+1],winner=a&&!b?a:!a&&b?b:null;
      cupMatches.push({id:`c1-${i}`,round:1,index:i,a:a||null,b:b||null,p1:null,p2:null,status:winner?'finished':'pending',winner,best:totalRounds===1?7:5,wo:!!winner});
    }
    for(let r=2;r<=totalRounds;r++){const count=size/(2**r);for(let i=0;i<count;i++)cupMatches.push({id:`c${r}-${i}`,round:r,index:i,a:null,b:null,p1:null,p2:null,status:'waiting',winner:null,best:r===totalRounds?7:5,wo:false})}
    simState.cup={qualifiers:q,size,totalRounds,matches:cupMatches};
    advanceCup();renderCup(true);
  }

  function advanceCup(){
    const c=simState?.cup;if(!c)return;
    for(let r=1;r<c.totalRounds;r++){
      const cur=c.matches.filter(m=>m.round===r).sort((a,b)=>a.index-b.index),next=c.matches.filter(m=>m.round===r+1).sort((a,b)=>a.index-b.index);
      cur.forEach((m,i)=>{if(!m.winner)return;const t=next[Math.floor(i/2)];if(!t)return;if(i%2===0)t.a=m.winner;else t.b=m.winner;if(t.a&&t.b&&t.status==='waiting')t.status='pending'});
    }
  }

  function cupDoneCount(){return simState?.cup?.matches.filter(m=>m.status==='finished').length||0}
  function finalMatch(){const c=simState?.cup;return c?c.matches.find(m=>m.round===c.totalRounds):null}
  function cupPlayerHtml(p,{winner=false,bye=false}={}){
    if(!p)return bye?'<span class="cup-bye">BYE</span>':'<span class="cup-name muted">Venter</span>';
    return `<span class="cup-seed">${escLocal(p.seedLabel||`${p.pos||''}P${p.group||''}`)}</span><span class="cup-name">${escLocal(p.name)}</span>`;
  }

  function renderCup(scroll=false){
    const c=simState?.cup;if(!c)return;
    advanceCup();$('cupSetup')?.classList.add('hidden');$('cupLobby')?.classList.remove('hidden');
    const final=finalMatch();$('cupProgress').textContent=final?.winner?`Vinner: ${final.winner.name}`:`${cupDoneCount()} / ${c.matches.length} cupkamper ferdig • TESTMODUS`;
    let controls=$('cupSimulationControls');if(!controls){controls=document.createElement('div');controls.id='cupSimulationControls';controls.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:12px 0';controls.innerHTML='<button id="simulateRemainingCupBtn" class="primary">Simuler resterende cup</button><button id="resetCupSimulationBtn" class="outline">Nullstill cup</button><span class="status" style="align-self:center">Kun lokal test</span>';$('cupBracket')?.insertAdjacentElement('beforebegin',controls)}
    $('cupBracket').innerHTML=Array.from({length:c.totalRounds},(_,i)=>i+1).map(r=>`<div class="cup-round"><div class="cup-round-title">${roundName(r,c.totalRounds)}</div>${c.matches.filter(m=>m.round===r).sort((a,b)=>a.index-b.index).map(m=>{const score=m.wo?'WO':m.status==='finished'?`${m.p1}–${m.p2}`:'vs',aBye=m.round===1&&m.wo&&!m.a,bBye=m.round===1&&m.wo&&!m.b;return `<div class="cup-match simulation-cup-match" role="button" tabindex="0" data-sim-cup-id="${m.id}"><div class="cup-player ${m.winner&&m.a&&m.winner.id===m.a.id?'winner':''}">${cupPlayerHtml(m.a,{winner:m.winner===m.a,bye:aBye})}</div><div class="cup-score">${score}</div><div class="cup-player ${m.winner&&m.b&&m.winner.id===m.b.id?'winner':''}">${cupPlayerHtml(m.b,{winner:m.winner===m.b,bye:bBye})}</div></div>`}).join('')}</div>`).join('');
    if(scroll)$('cupLobby')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function paint(scroll=false){
    if(!simState)return;restoring=true;$('groupSetup')?.classList.add('hidden');$('groupLobby')?.classList.remove('hidden');ensureControls();const done=simState.matches.filter(m=>m.status==='finished').length,total=simState.matches.length;
    $('groupProgress').textContent=`${done} / ${total} kamper ferdig • TESTMODUS`;
    $('tStatus').textContent='Puljespill (simulering)';
    $('tInfo').textContent=done===total?'TESTMODUS: Alle puljekamper er ferdige. Cup kan testes nå.':'TESTMODUS: Klikk en kamp for å legge inn resultat, eller simuler alle puljekampene.';
    $('liveGroups').innerHTML=renderGroupHtml();
    const cupBtn=$('startCupSimulationBtn');if(cupBtn)cupBtn.classList.toggle('hidden',done!==total);
    restoring=false;if(scroll)$('groupLobby')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(simState.cup)renderCup(false);
  }

  function render(){simState=buildState();if(!simState){alert('Kunne ikke lese den simulerte trekningen. Trekk puljene på nytt.');return}simViewActive=true;window.dartArenaSimulationViewActive=true;paint(true)}
  function randomGroupResult(m){const win=targetWins(simState.best),loser=Math.floor(Math.random()*win);if(Math.random()<.5){m.p1=win;m.p2=loser}else{m.p1=loser;m.p2=win}m.status='finished'}
  function editGroupMatch(m){const win=targetWins(simState.best),current=m.status==='finished'?`${m.p1}-${m.p2}`:`${win}-0`,input=prompt(`${m.a.name} vs ${m.b.name}\nBest av ${simState.best}\n\nSkriv sluttresultat:`,current);if(input===null)return;const x=input.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);if(!x)return alert('Skriv resultat som for eksempel 3-1.');const p1=Number(x[1]),p2=Number(x[2]);if(!((p1===win&&p2<win)||(p2===win&&p1<win)))return alert(`Ugyldig resultat. I Best av ${simState.best} må vinneren ha ${win} legs.`);m.p1=p1;m.p2=p2;m.status='finished';paint(false)}

  function editCupMatch(m){
    if(!m.a||!m.b)return alert('Denne kampen venter på spillere fra forrige runde.');if(m.wo)return;
    const win=targetWins(m.best),current=m.status==='finished'?`${m.p1}-${m.p2}`:`${win}-0`,input=prompt(`${m.a.name} vs ${m.b.name}\n${roundName(m.round,simState.cup.totalRounds)} • Best av ${m.best}\n\nSkriv sluttresultat:`,current);if(input===null)return;const x=input.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);if(!x)return alert('Skriv resultat som for eksempel 3-1.');const p1=Number(x[1]),p2=Number(x[2]);if(!((p1===win&&p2<win)||(p2===win&&p1<win)))return alert(`Ugyldig resultat. I Best av ${m.best} må vinneren ha ${win} legs.`);m.p1=p1;m.p2=p2;m.winner=p1>p2?m.a:m.b;m.status='finished';advanceCup();renderCup(false)}
  function randomCupResult(m){if(!m.a||!m.b||m.status==='finished')return false;const win=targetWins(m.best),loser=Math.floor(Math.random()*win);if(Math.random()<.5){m.p1=win;m.p2=loser;m.winner=m.a}else{m.p1=loser;m.p2=win;m.winner=m.b}m.status='finished';return true}
  function simulateRemainingCup(){const c=simState?.cup;if(!c)return;for(let r=1;r<=c.totalRounds;r++){advanceCup();c.matches.filter(m=>m.round===r).forEach(randomCupResult)}advanceCup();renderCup(false)}

  const observer=new MutationObserver(()=>{if(!simViewActive||restoring||!simState)return;const lobby=$('groupLobby'),live=$('liveGroups');if(!lobby||!live)return;if(lobby.classList.contains('hidden')||!live.querySelector('.simulation-group'))paint(false)});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  document.addEventListener('click',e=>{
    const start=e.target.closest('#startGroupsBtn');if(start&&simulation){e.preventDefault();e.stopImmediatePropagation();render();return}
    if(e.target.closest('#simulateAllMatchesBtn')){e.preventDefault();simState?.matches.filter(m=>m.status!=='finished').forEach(randomGroupResult);paint(false);return}
    if(e.target.closest('#resetSimulationBtn')){e.preventDefault();simState?.matches.forEach(m=>{m.p1=null;m.p2=null;m.status='pending'});simState.cup=null;$('cupLobby')?.classList.add('hidden');$('cupSimulationControls')?.remove();paint(false);return}
    if(e.target.closest('#startCupSimulationBtn')){e.preventDefault();buildCup();return}
    if(e.target.closest('#simulateRemainingCupBtn')){e.preventDefault();simulateRemainingCup();return}
    if(e.target.closest('#resetCupSimulationBtn')){e.preventDefault();simState.cup=null;$('cupLobby')?.classList.add('hidden');$('cupSimulationControls')?.remove();paint(false);return}
    const toggle=e.target.closest('#simulate8Btn');if(toggle&&simViewActive){simViewActive=false;window.dartArenaSimulationViewActive=false;simState=null;$('simulationControls')?.remove();$('cupSimulationControls')?.remove()}
    const match=e.target.closest('.simulation-match');if(match&&simState){e.preventDefault();const m=simState.matches.find(x=>x.id===match.dataset.simId);if(m)editGroupMatch(m);return}
    const cupMatch=e.target.closest('.simulation-cup-match');if(cupMatch&&simState?.cup){e.preventDefault();const m=simState.cup.matches.find(x=>x.id===cupMatch.dataset.simCupId);if(m)editCupMatch(m)}
  },true);
})();