(()=>{
  if(!window.supabase)return;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const $=id=>document.getElementById(id);
  let timer=null,loading=false,currentUserId=null,activeFilter='all',lastRows=[],lastNames={};
  const viewerChannels=new Map(),viewerCounts=new Map();

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function gameLabel(m){
    if(m.game_variant==='jdc')return'JDC Challenge';
    if(m.game_variant==='cricket')return'Cricket';
    if(m.game_variant==='half_it')return'Half-It';
    if(m.game_variant==='sixty_one')return'61';
    return String(m.game||501);
  }
  function filterKey(m){
    if(m.game_variant==='jdc')return'jdc';
    if(m.game_variant==='cricket')return'cricket';
    if(m.game_variant==='half_it')return'half_it';
    if(m.game_variant==='sixty_one')return'sixty_one';
    return'x01';
  }
  function formatLabel(m){
    if(m.game_variant==='jdc')return'57 piler hver';
    if(m.game_variant==='half_it')return'12 runder';
    const legs=Number(m.legs||1);return`Best of ${legs}`;
  }
  function resultLabel(m){
    if(m.game_variant==='jdc')return`${Number(m.player1_score||0)}–${Number(m.player2_score||0)} poeng`;
    return`${Number(m.player1_legs||0)}–${Number(m.player2_legs||0)} i legs`;
  }
  function viewerCountFor(ch){
    if(!ch)return 0;
    let count=0;
    Object.values(ch.presenceState()).flat().forEach(p=>{if(p.role==='spectator')count++});
    return count;
  }
  function paintViewerCount(matchId){
    const el=document.querySelector(`[data-viewer-count="${CSS.escape(matchId)}"]`);
    if(el)el.textContent=`👁 ${viewerCounts.get(matchId)||0} ser på`;
  }
  function ensureViewerChannel(matchId){
    if(viewerChannels.has(matchId))return;
    const ch=db.channel(`match-viewers-${matchId}`)
      .on('presence',{event:'sync'},()=>{viewerCounts.set(matchId,viewerCountFor(ch));paintViewerCount(matchId)})
      .on('presence',{event:'join'},()=>{viewerCounts.set(matchId,viewerCountFor(ch));paintViewerCount(matchId)})
      .on('presence',{event:'leave'},()=>{viewerCounts.set(matchId,viewerCountFor(ch));paintViewerCount(matchId)})
      .subscribe(status=>{if(status==='SUBSCRIBED'){viewerCounts.set(matchId,viewerCountFor(ch));paintViewerCount(matchId)}});
    viewerChannels.set(matchId,ch);
  }
  function syncViewerChannels(rows){
    const liveRows=rows.filter(m=>m.is_live!==false);
    const activeIds=new Set(liveRows.map(m=>m.id));
    for(const [id,ch] of viewerChannels){
      if(activeIds.has(id))continue;
      viewerChannels.delete(id);viewerCounts.delete(id);db.removeChannel(ch).catch(()=>{});
    }
    liveRows.forEach(m=>ensureViewerChannel(m.id));
  }
  function ensureFilters(){
    const section=$('liveMatchesSection');
    if(!section||$('liveMatchFilters'))return;
    const filters=document.createElement('div');
    filters.id='liveMatchFilters';
    filters.className='live-match-filters';
    filters.innerHTML=[
      ['all','Alle'],['x01','X01'],['cricket','Cricket'],['half_it','Half-It'],['sixty_one','61'],['jdc','JDC']
    ].map(([key,label])=>`<button type="button" class="outline live-match-filter${key==='all'?' active':''}" data-live-filter="${key}">${label}</button>`).join('');
    const list=$('liveMatchesList');
    list?.insertAdjacentElement('beforebegin',filters);
    filters.querySelectorAll('[data-live-filter]').forEach(button=>button.onclick=()=>{
      activeFilter=button.dataset.liveFilter||'all';
      filters.querySelectorAll('[data-live-filter]').forEach(x=>x.classList.toggle('active',x===button));
      renderRows();
    });
  }
  function renderRows(){
    const host=$('liveMatchesList');if(!host)return;
    const rows=lastRows.filter(m=>activeFilter==='all'||filterKey(m)===activeFilter);
    if(!lastRows.length){host.innerHTML='<p class="muted">Ingen pågående kamper akkurat nå.</p>';return}
    if(!rows.length){host.innerHTML='<p class="muted">Ingen pågående kamper i dette filteret.</p>';return}
    host.innerHTML=rows.map(m=>{
      const mine=[m.player1_id,m.player2_id].includes(currentUserId),p1=lastNames[m.player1_id]||m.player1_name||'Spiller 1',p2=lastNames[m.player2_id]||m.player2_name||'Spiller 2';
      const warmup=m.is_warmup?'<span class="live-match-badge">OPPVARMING</span>':'';
      const isLive=m.is_live!==false;
      const liveBadge=`<span class="live-state-badge ${isLive?'is-live':'is-private'}">${isLive?'LIVE':'IKKE LIVE'}</span>`;
      const viewers=isLive?viewerCounts.get(m.id)||0:0;
      const viewerMeta=isLive?`<span class="live-match-viewers" data-viewer-count="${esc(m.id)}">👁 ${viewers} ser på</span>`:'';
      const action=isLive?`<div class="live-match-actions"><button class="${mine?'primary':'outline'}" data-live-match="${esc(m.id)}" data-live-own="${mine?'1':'0'}">${mine?'Gå til kamp':'Spectate'}</button></div>`:'';
      return `<article class="live-match-row${mine?' is-mine':''}${isLive?'':' is-private'}"><div class="live-match-main"><div class="live-match-title"><span>${esc(p1)} vs ${esc(p2)}</span>${mine?'<span class="live-match-badge">MIN KAMP</span>':''}${warmup}</div><div class="live-match-meta"><span><i class="live-dot"></i>Pågår</span>${liveBadge}<span>${esc(gameLabel(m))}</span><span>${esc(formatLabel(m))}</span><span class="live-match-score">${esc(resultLabel(m))}</span>${viewerMeta}</div></div>${action}</article>`;
    }).join('');
    host.querySelectorAll('[data-live-match]').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.liveMatch;
      if(btn.dataset.liveOwn==='1'){
        const m=lastRows.find(x=>x.id===id);
        const page=window.DartArenaGames?.pageForVariant?.(m?.game_variant||'x01')||'match.html';
        const w=window.open(`${page}?id=${encodeURIComponent(id)}`,`dartarena-match-${id}`);
        if(w){try{w.focus()}catch{}}else location.href=`${page}?id=${encodeURIComponent(id)}`;
      }else{
        const w=window.open(`spectate.html?build=20261002-rpc2&id=${encodeURIComponent(id)}`,`dartarena-spectate-${id}`);
        if(w){try{w.focus()}catch{}}
      }
    });
  }
  async function load(){
    if(loading||!$('liveMatchesList'))return;loading=true;
    try{
      ensureFilters();
      const {data:{session}}=await db.auth.getSession();
      currentUserId=session?.user?.id||null;
      if(!currentUserId)return;
      const {data:matches,error}=await db.rpc('get_lobby_active_matches');
      if(error)throw error;
      const rows=matches||[];
      syncViewerChannels(rows);
      lastNames={};
      rows.forEach(m=>{
        if(m.player1_id&&m.player1_name)lastNames[m.player1_id]=m.player1_name;
        if(m.player2_id&&m.player2_name)lastNames[m.player2_id]=m.player2_name;
      });
      lastRows=[...rows].sort((a,b)=>{
        const am=[a.player1_id,a.player2_id].includes(currentUserId)?0:1;
        const bm=[b.player1_id,b.player2_id].includes(currentUserId)?0:1;
        return am-bm||new Date(b.created_at)-new Date(a.created_at);
      });
      renderRows();
    }catch(e){console.error('Live match list failed',e);$('liveMatchesList').innerHTML='<p class="muted">Kunne ikke laste pågående kamper.</p>'}
    finally{loading=false}
  }
  function start(){ensureFilters();load();clearInterval(timer);timer=setInterval(load,3000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('pagehide',()=>{clearInterval(timer);viewerChannels.forEach(ch=>db.removeChannel(ch).catch(()=>{}));viewerChannels.clear()},{once:true});
})();