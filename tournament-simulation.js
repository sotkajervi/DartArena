// DartArena test-only group lobby. Simulated players/matches stay local and are never written to Supabase.
(function(){
  const $=id=>document.getElementById(id);
  const escLocal=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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

  // IMPORTANT: use drawnGroups directly. Reading .status from the preview was wrong after
  // drag/drop was added because .status is the group-size badge, e.g. "(4)".
  function snapshotGroups(){
    if(!Array.isArray(drawnGroups))return [];
    return drawnGroups.map(group=>group.map(player=>({
      id:player.user_id,
      name:names[player.user_id]||'Testspiller'
    })));
  }

  function render(){
    const groups=snapshotGroups();
    if(!groups.length||groups.some(g=>!g.length)){
      alert('Kunne ikke lese den simulerte trekningen. Trekk puljene på nytt.');
      return;
    }

    const best=Number($('groupBestOf').value||5);
    const adv=$('advanceCount').value;
    const total=groups.reduce((n,g)=>n+(g.length*(g.length-1))/2,0);

    $('groupSetup').classList.add('hidden');
    $('groupLobby').classList.remove('hidden');
    $('groupProgress').textContent=`0 / ${total} kamper ferdig • TESTMODUS`;
    $('tStatus').textContent='Puljespill (simulering)';
    $('tInfo').textContent='TESTMODUS: Puljer, tabeller og kamper simuleres lokalt. Ingenting lagres i Supabase.';

    $('liveGroups').innerHTML=groups.map((players,gi)=>{
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

    $('groupLobby').scrollIntoView({behavior:'smooth',block:'start'});
  }

  document.addEventListener('click',e=>{
    const start=e.target.closest('#startGroupsBtn');
    if(start&&simulation){
      e.preventDefault();
      e.stopImmediatePropagation();
      render();
      return;
    }

    const match=e.target.closest('.simulation-match');
    if(match){
      e.preventDefault();
      alert(`${match.dataset.playerA} vs ${match.dataset.playerB}\n\nTestkamp. Simuleringen kontrollerer nå puljeoppsett og kampplan. Ingen data lagres.`);
    }
  },true);
})();