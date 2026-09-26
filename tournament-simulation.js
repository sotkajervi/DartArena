// DartArena test-only group lobby. Never writes simulated players or matches to Supabase.
(function(){
  const $=id=>document.getElementById(id);
  function cleanName(s){return s.replace(/\(test\)/gi,'').trim()}
  function rr(players){let a=[...players];if(a.length%2)a.push(null);const rounds=[];for(let r=0;r<a.length-1;r++){const games=[];for(let i=0;i<a.length/2;i++){const p1=a[i],p2=a[a.length-1-i];if(p1&&p2)games.push([p1,p2])}rounds.push(games);a=[a[0],a[a.length-1],...a.slice(1,-1)]}return rounds}
  function readGroups(){return [...$('groupPreview').children].map(card=>[...card.querySelectorAll('.status')].map(x=>cleanName(x.textContent))).filter(g=>g.length)}
  function render(){
    const groups=readGroups(); if(!groups.length)return;
    const best=Number($('groupBestOf').value||5),adv=$('advanceCount').value;
    const total=groups.reduce((n,g)=>n+g.length*(g.length-1)/2,0);
    $('groupSetup').classList.add('hidden');$('groupLobby').classList.remove('hidden');
    $('groupProgress').textContent=`0 / ${total} kamper ferdig • TESTMODUS`;
    $('tStatus').textContent='Puljespill (simulering)';
    $('tInfo').textContent='TESTMODUS: Puljer, tabeller og kamper simuleres lokalt. Ingenting lagres i Supabase.';
    $('liveGroups').innerHTML=groups.map((players,gi)=>{
      const qualify=adv==='all'?players.length:Number(adv||0),rounds=rr(players);
      return `<div class="group-card"><div class="heading"><div><small>PULJE ${gi+1}</small><h2>${players.length} spillere</h2></div><div class="status">Best av ${best}</div></div>
      <table class="standings"><thead><tr><th>#</th><th>Spiller</th><th>V</th><th>+/-</th><th>Legs</th></tr></thead><tbody>${players.map((p,i)=>`<tr class="${i<qualify?'qualify':''}"><td>${i+1}</td><td>${p}</td><td>0</td><td>0</td><td>0</td></tr>`).join('')}</tbody></table>
      ${rounds.map((round,ri)=>`<div class="round-block"><div class="round-title">Runde ${ri+1}</div>${round.map(([a,b])=>`<div class="match-row"><div class="match-players"><strong>${a}</strong> <span class="muted">vs</span> <strong>${b}</strong><div class="match-state">Klar</div></div><div class="match-score">vs</div></div>`).join('')}</div>`).join('')}</div>`
    }).join('');
    $('groupLobby').scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('#startGroupsBtn');
    if(!b||!b.textContent.toLowerCase().includes('simulering'))return;
    e.preventDefault();e.stopImmediatePropagation();render();
  },true);
})();