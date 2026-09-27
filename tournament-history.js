// Finished tournament archive in the main lobby.
(()=>{
  const $=id=>document.getElementById(id),esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db,me,channel,filtering=false;
  function fmt(d){try{return new Intl.DateTimeFormat('nb-NO',{dateStyle:'short',timeStyle:'short'}).format(new Date(d))}catch{return d||''}}
  async function load(){
    if(!db||filtering)return;filtering=true;
    try{
      const {data:t,error}=await db.from('tournaments').select('*').eq('status','finished').order('starts_at',{ascending:false}).limit(30);
      if(error)throw error;
      const rows=t||[],ids=rows.map(x=>x.id);let members=[];
      if(ids.length){const r=await db.from('tournament_members').select('tournament_id,role').in('tournament_id',ids);members=r.data||[]}
      const counts={};members.forEach(m=>{if(m.role==='participant')counts[m.tournament_id]=(counts[m.tournament_id]||0)+1});
      const box=$('pastTournamentList');if(box)box.innerHTML=rows.length?rows.map(x=>`<article class="tournament-row"><div><div class="player-name">${esc(x.name)}</div><div class="status">${x.tournament_type==='groups_cup'?'Puljer + cup':'Ren cup'} • ${fmt(x.starts_at)} • ${counts[x.id]||0} deltakere</div></div><div class="challenge-actions"><button class="small-btn" data-history-open="${x.id}">Se turnering</button><button class="small-btn" data-history-stats="${x.id}">Sluttstatistikk</button></div></article>`).join(''):'<p class="muted">Ingen ferdige turneringer ennå.</p>';
      document.querySelectorAll('[data-history-open]').forEach(b=>b.onclick=()=>location.href=`tournament.html?id=${encodeURIComponent(b.dataset.historyOpen)}`);
      document.querySelectorAll('[data-history-stats]').forEach(b=>b.onclick=()=>location.href=`tournament-results.html?id=${encodeURIComponent(b.dataset.historyStats)}`);

      // Keep the normal tournament lobby focused on current/upcoming events.
      const finished=new Set(ids);
      document.querySelectorAll('#tournamentList .tournament-row').forEach(row=>{const b=row.querySelector('[data-open]');if(b&&finished.has(b.dataset.open))row.remove()});
      const main=$('tournamentList');if(main&&!main.querySelector('.tournament-row')&&main.textContent.trim()==='')main.innerHTML='<p class="muted">Ingen aktive turneringer akkurat nå.</p>';
    }catch(err){console.error('Tournament history failed',err);if($('pastTournamentList'))$('pastTournamentList').innerHTML='<p class="muted">Kunne ikke laste tidligere turneringer.</p>'}
    finally{filtering=false}
  }
  async function boot(){
    if(!window.supabase||!$('pastTournamentList'))return;
    db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
    const {data:{session}}=await db.auth.getSession();if(!session)return;me=session.user.id;await load();
    channel=db.channel('tournament-history').on('postgres_changes',{event:'*',schema:'public',table:'tournaments'},()=>setTimeout(load,80)).on('postgres_changes',{event:'*',schema:'public',table:'tournament_members'},()=>setTimeout(load,80)).subscribe();
    new MutationObserver(()=>{if(!filtering)setTimeout(load,40)}).observe($('tournamentList'),{childList:true,subtree:true});
  }
  const wait=setInterval(()=>{if(window.supabase&&$('pastTournamentList')){clearInterval(wait);boot()}},100);
})();