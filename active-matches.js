(()=>{
  if(!window.supabase)return;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const $=id=>document.getElementById(id);
  let timer=null,loading=false,currentUserId=null;
  const viewerChannels=new Map(),viewerCounts=new Map();

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function gameLabel(m){
    if(m.game_variant==='jdc')return'JDC Challenge';
    if(m.game_variant==='cricket')return'Cricket';
    if(m.game_variant==='half_it')return'Half-It';
    if(m.game_variant==='sixty_one')return'61';
    return String(m.game||501);
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
    const activeIds=new Set(rows.map(m=>m.id));
    for(const [id,ch] of viewerChannels){
      if(activeIds.has(id))continue;
      viewerChannels.delete(id);viewerCounts.delete(id);db.removeChannel(ch).catch(()=>{});
    }
    rows.forEach(m=>ensureViewerChannel(m.id));
  }
  async function load(){
    if(loading||!$('liveMatchesList'))return;loading=true;
    try{
      const {data:{session}}=await db.auth.getSession();
      currentUserId=session?.user?.id||null;
      if(!currentUserId)return;
      const {data:matches,error}=await db.from('matches').select('id,player1_id,player2_id,status,game,game_variant,legs,player1_legs,player2_legs,player1_score,player2_score,created_at,is_warmup').eq('status','playing').order('created_at',{ascending:false});
      if(error)throw error;
      const rows=matches||[];
      syncViewerChannels(rows);
      if(!rows.length){$('liveMatchesList').innerHTML='<p class="muted">Ingen pågående kamper akkurat nå.</p>';return}
      const ids=[...new Set(rows.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))];
      const {data:people}=await db.from('profiles').select('id,username').in('id',ids);
      const names=Object.fromEntries((people||[]).map(p=>[p.id,p.username]));
      const sorted=[...rows].sort((a,b)=>{
        const am=[a.player1_id,a.player2_id].includes(currentUserId)?0:1;
        const bm=[b.player1_id,b.player2_id].includes(currentUserId)?0:1;
        return am-bm||new Date(b.created_at)-new Date(a.created_at);
      });
      $('liveMatchesList').innerHTML=sorted.map(m=>{
        const mine=[m.player1_id,m.player2_id].includes(currentUserId),p1=names[m.player1_id]||'Spiller 1',p2=names[m.player2_id]||'Spiller 2';
        const warmup=m.is_warmup?'<span class="live-match-badge">OPPVARMING</span>':'';
        const viewers=viewerCounts.get(m.id)||0;
        return `<article class="live-match-row${mine?' is-mine':''}"><div class="live-match-main"><div class="live-match-title"><span>${esc(p1)} vs ${esc(p2)}</span>${mine?'<span class="live-match-badge">MIN KAMP</span>':''}${warmup}</div><div class="live-match-meta"><span><i class="live-dot"></i>Pågår</span><span>${esc(gameLabel(m))}</span><span>${esc(formatLabel(m))}</span><span class="live-match-score">${esc(resultLabel(m))}</span><span class="live-match-viewers" data-viewer-count="${esc(m.id)}">👁 ${viewers} ser på</span></div></div><div class="live-match-actions"><button class="${mine?'primary':'outline'}" data-live-match="${esc(m.id)}" data-live-own="${mine?'1':'0'}">${mine?'Gå til kamp':'Spectate'}</button></div></article>`;
      }).join('');
      $('liveMatchesList').querySelectorAll('[data-live-match]').forEach(btn=>btn.onclick=()=>{
        const id=btn.dataset.liveMatch;if(btn.dataset.liveOwn==='1'){
          const m=rows.find(x=>x.id===id);if(typeof openMatch==='function')openMatch(id,true,m?.game_variant||'x01');
        }else window.open(`spectate.html?id=${encodeURIComponent(id)}`,`dartarena-spectate-${id}`);
      });
    }catch(e){console.error('Live match list failed',e);$('liveMatchesList').innerHTML='<p class="muted">Kunne ikke laste pågående kamper.</p>'}
    finally{loading=false}
  }
  function start(){load();clearInterval(timer);timer=setInterval(load,3000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('pagehide',()=>{clearInterval(timer);viewerChannels.forEach(ch=>db.removeChannel(ch).catch(()=>{}));viewerChannels.clear()},{once:true});
})();