// DartArena test-only group lobby. Simulated players/matches stay local and are never written to Supabase.
(function(){
  const $=id=>document.getElementById(id);
  const escLocal=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  let simViewActive=false;
  let simSnapshot=null;
  let restoring=false;

  const realLoad=typeof window.load==='function'?window.load:null;
  const realLoadGroupLobby=typeof window.loadGroupLobby==='function'?window.loadGroupLobby:null;

  // Supabase/realtime refreshes must not replace the local simulation with an empty DB view.
  if(realLoad){
    window.load=async function(...args){
      if(simViewActive)return;
      return realLoad.apply(this,args);
    };
  }
  if(realLoadGroupLobby){
    window.loadGroupLobby=async function(...args){
      if(simViewActive)return;
      return realLoadGroupLobby.apply(this,args);
    };
  }

  function rr(players){
    let a=[...players];
    if(a.length%2)a.push(null);
    const rounds=[];
    for(let r=0;r<a.length-1;r++){
      const games=[];
      for(let i=0;i<a.length/2;i++){
        const p1=a[i],p2=a[a.length-1-i];
        if(p1&&p2)games.push([p1,p2]);
      }
      rounds.push(games);
      a=[a[0],a[a.length-1],...a.slice(1,-1)];
    }
    return rounds;
  }

  function snapshotGroups(){
    if(!Array.isArray(drawnGroups))return [];
    return drawnGroups.map(group=>group.map(player=>({
      id:player.user_id,
      name:names[player.user_id]||'Testspiller'
    })));
  }

  function buildSnapshot(){
    const groups=snapshotGroups();
    if(!groups.length||groups.some(g=>!g.length))return null;
    const best=Number($('groupBestOf').value||5);
    const adv=$('advanceCount').value;
    const total=groups.reduce((n,g)=>n+(g.length*(g.length-1))/2,0);
    const html=groups.map((players,gi)=>{
      const qualify=adv==='all'?players.length:Math.min(players.length,Number(adv||0));
      const rounds=rr(players);
      return `<div class="group-card simulation-group" data-sim-group="${gi}">
        <div class="heading"><div><small>PULJE ${gi+1}</small><h2>${players.length} spillere</h2></div><div class="status">Best av ${best}</div></div>
        <table class="standings"><thead><tr><th>#</th><th>Spiller</th><th>V</th><th>+/-</th><th>Legs</th></tr></thead><tbody>
          ${players.map((p,i)=>`<tr class="${i<qualify?'qualify':''}"><td>${i+1}</td><td>${escLocal(p.name)}</td><td>0</td><td>0</td><td>0</td></tr>`).join('')}
        </tbody></table>
        ${rounds.map((round,ri)=>`<div class="round-block"><div class="round-title">Runde ${ri+1}</div>${round.map(([a,b],mi)=>`<div class="match-row simulation-match" role="button" tabindex="0" data-group="${gi}" data-round="${ri}" data-match="${mi}" data-player-a="${escLocal(a.name)}" data-player-b="${escLocal(b.name)}"><div class="match-players"><strong>${escLocal(a.name)}</strong><span class="muted">vs</span><strong>${escLocal(b.name)}</strong><span class="match-state">Klar</span></div><div class="match-score">vs</div></div>`).join('')}</div>`).join('')}
      </div>`;
    }).join('');
    return {groups,best,adv,total,html};
  }

  function paint(scroll=false){
    if(!simSnapshot)return;
    restoring=true;
    $('groupSetup')?.classList.add('hidden');
    $('groupLobby')?.classList.remove('hidden');
    if($('groupProgress'))$('groupProgress').textContent=`0 / ${simSnapshot.total} kamper ferdig • TESTMODUS`;
    if($('tStatus'))$('tStatus').textContent='Puljespill (simulering)';
    if($('tInfo'))$('tInfo').textContent='TESTMODUS: Puljer, tabeller og kamper simuleres lokalt. Ingenting lagres i Supabase.';
    if($('liveGroups')&&$('liveGroups').innerHTML!==simSnapshot.html)$('liveGroups').innerHTML=simSnapshot.html;
    restoring=false;
    if(scroll)$('groupLobby')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function render(){
    simSnapshot=buildSnapshot();
    if(!simSnapshot){
      alert('Kunne ikke lese den simulerte trekningen. Trekk puljene på nytt.');
      return;
    }
    simViewActive=true;
    window.dartArenaSimulationViewActive=true;
    paint(true);
  }

  // Extra guard: if another script changes/hides the simulation DOM, restore it immediately.
  const observer=new MutationObserver(()=>{
    if(!simViewActive||restoring||!simSnapshot)return;
    const lobby=$('groupLobby'),live=$('liveGroups');
    if(!lobby||!live)return;
    if(lobby.classList.contains('hidden')||!live.querySelector('.simulation-group'))paint(false);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  document.addEventListener('click',e=>{
    const start=e.target.closest('#startGroupsBtn');
    if(start&&simulation){
      e.preventDefault();
      e.stopImmediatePropagation();
      render();
      return;
    }

    const simToggle=e.target.closest('#simulate8Btn');
    if(simToggle&&simViewActive){
      simViewActive=false;
      window.dartArenaSimulationViewActive=false;
      simSnapshot=null;
    }

    const match=e.target.closest('.simulation-match');
    if(match){
      e.preventDefault();
      alert(`${match.dataset.playerA} vs ${match.dataset.playerB}\n\nTestkamp. Simuleringen kontrollerer nå puljeoppsett og kampplan. Ingen data lagres.`);
    }
  },true);
})();