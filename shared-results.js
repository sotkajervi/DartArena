(()=>{
  if(window.__dartArenaSharedResults||!window.supabase)return;
  window.__dartArenaSharedResults=true;
  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId)return;
  const resultDb=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  let shownFor=null,ch=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=(a,b)=>b?`${Math.round(a/b*100)}%`:'0%';
  const num=v=>Number(v||0);

  function gameLabel(m){
    if(m.game_variant==='cricket')return'Cricket';
    if(m.game_variant==='sixty_one')return'61';
    if(m.game_variant==='half_it')return m.game_config?.half_it_mode==='standard'?'Half-It (Standard)':'Half-It (DartCounter)';
    return String(m.game||'X01');
  }
  function scoreInfo(m){
    if(m.match_mode==='sets'&&m.game_variant!=='cricket'&&m.game_variant!=='half_it'&&m.game_variant!=='sixty_one')return{a:num(m.player1_sets),b:num(m.player2_sets),label:'SETS'};
    return{a:num(m.player1_legs),b:num(m.player2_legs),label:'LEGS'};
  }
  async function namesFor(m){
    const{data}=await resultDb.from('profiles').select('id,username').in('id',[m.player1_id,m.player2_id]);
    return Object.fromEntries((data||[]).map(p=>[p.id,p.username]));
  }
  function emptyStats(){return[{value:'–',label:'STAT 1'},{value:'–',label:'STAT 2'},{value:'–',label:'STAT 3'}]}
  async function x01Stats(m){
    const{data}=await resultDb.from('match_throws').select('player_id,score,darts_used,is_checkout').eq('match_id',m.id);
    const out={};for(const id of[m.player1_id,m.player2_id])out[id]={score:0,darts:0,high:0,n180:0};
    for(const r of data||[]){const s=out[r.player_id];if(!s)continue;s.score+=num(r.score);s.darts+=r.is_checkout?Math.max(1,num(r.darts_used)||3):3;if(r.is_checkout)s.high=Math.max(s.high,num(r.score));if(num(r.score)===180)s.n180++}
    const mk=id=>{const s=out[id];return[{value:s.darts?(s.score/s.darts*3).toFixed(2):'0.00',label:'3-DART AVG'},{value:s.high,label:'HØYESTE UT'},{value:s.n180,label:'180'}]};
    return{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)};
  }
  async function cricketStats(m){
    const{data}=await resultDb.from('cricket_visits').select('player_id,points_scored').eq('match_id',m.id);
    const out={};for(const id of[m.player1_id,m.player2_id])out[id]={visits:0,points:0};
    for(const r of data||[]){const s=out[r.player_id];if(!s)continue;s.visits++;s.points+=num(r.points_scored)}
    const mk=id=>{const s=out[id];return[{value:s.visits,label:'VISITS'},{value:s.points,label:'POENG'},{value:s.visits?(s.points/s.visits).toFixed(1):'0.0',label:'POENG/VISIT'}]};
    return{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)};
  }
  async function halfItStats(m){
    const{data}=await resultDb.from('half_it_visits').select('player_id,success').eq('match_id',m.id);
    const out={};for(const id of[m.player1_id,m.player2_id])out[id]={ok:0,total:0};
    for(const r of data||[]){const s=out[r.player_id];if(!s)continue;s.total++;if(r.success)s.ok++}
    const mk=id=>{const s=out[id];return[{value:s.ok,label:'TREFFRUNDER'},{value:s.total-s.ok,label:'HALVERINGER'},{value:pct(s.ok,s.total),label:'SUKSESS'}]};
    return{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)};
  }
  async function sixtyOneStats(m){
    const{data}=await resultDb.from('sixty_one_visits').select('player_id,result,target_before').eq('match_id',m.id);
    const out={};for(const id of[m.player1_id,m.player2_id])out[id]={high:0,hit:0,miss:0};
    for(const r of data||[]){const s=out[r.player_id];if(!s)continue;if(r.result==='hit'){s.hit++;s.high=Math.max(s.high,num(r.target_before))}else if(r.result==='miss')s.miss++}
    const mk=id=>{const s=out[id];return[{value:s.high,label:'HØYESTE UT'},{value:s.hit,label:'TREFF'},{value:s.miss,label:'BOM'}]};
    return{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)};
  }
  async function statsFor(m){
    try{
      if(m.game_variant==='cricket')return await cricketStats(m);
      if(m.game_variant==='half_it')return await halfItStats(m);
      if(m.game_variant==='sixty_one')return await sixtyOneStats(m);
      return await x01Stats(m);
    }catch(e){console.warn('Result stats failed',e);return{[m.player1_id]:emptyStats(),[m.player2_id]:emptyStats()}}
  }
  function statHtml(stats){return(stats||emptyStats()).map(s=>`<div class="da-result-stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}
  async function showResult(m){
    if(!m||m.status!=='finished'||shownFor===m.id)return;
    shownFor=m.id;
    const[names,stats]=await Promise.all([namesFor(m),statsFor(m)]);
    const winner=m.winner_id,n1=names[m.player1_id]||'Spiller 1',n2=names[m.player2_id]||'Spiller 2',winName=winner?names[winner]||'Vinner':'Kampen';
    const score=scoreInfo(m),label=gameLabel(m);
    const overlay=document.createElement('div');overlay.id='dartArenaResultOverlay';overlay.className='da-result-overlay';
    overlay.innerHTML=`<section class="da-result-card" role="dialog" aria-modal="true" aria-label="Kampresultat"><div class="da-result-kicker">KAMP FERDIG • ${esc(label)}</div><h1 class="da-result-title">${esc(winName)}${winner?' vant!':' er ferdig'}</h1><div class="da-result-sub">Sluttresultat og kampstatistikk</div><div class="da-result-score"><div class="da-result-player ${winner===m.player1_id?'winner':''}"><div class="da-result-player-name">${esc(n1)}</div><div class="da-result-player-value">${score.a}</div></div><div class="da-result-vs"><strong>–</strong><span>${esc(score.label)}</span></div><div class="da-result-player ${winner===m.player2_id?'winner':''}"><div class="da-result-player-name">${esc(n2)}</div><div class="da-result-player-value">${score.b}</div></div></div><div class="da-result-stats"><article class="da-result-statcard ${winner===m.player1_id?'winner':''}"><div class="da-result-stat-name">${esc(n1)}</div><div class="da-result-statgrid">${statHtml(stats[m.player1_id])}</div></article><article class="da-result-statcard ${winner===m.player2_id?'winner':''}"><div class="da-result-stat-name">${esc(n2)}</div><div class="da-result-statgrid">${statHtml(stats[m.player2_id])}</div></article></div><div class="da-result-actions"><button id="daResultLobby" class="primary" type="button">Til lobby</button><button id="daResultClose" class="outline" type="button">Lukk kampfane</button></div><p class="da-result-note">DartArena • resultatet er lagret i kamphistorikken</p></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#daResultLobby').onclick=()=>location.href='./';
    overlay.querySelector('#daResultClose').onclick=()=>{window.close();setTimeout(()=>{if(!window.closed)location.href='./'},120)};
  }
  async function refresh(){
    const{data,error}=await resultDb.from('matches').select('*').eq('id',matchId).single();
    if(!error&&data?.status==='finished')await showResult(data);
  }
  async function boot(){
    const{data:{session}}=await resultDb.auth.getSession();if(!session)return;
    await refresh();
    ch=resultDb.channel('shared-result-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{if(p.new?.status==='finished')showResult(p.new)}).subscribe();
  }
  window.addEventListener('pagehide',()=>{if(ch)resultDb.removeChannel(ch)});
  boot().catch(e=>console.warn('Shared result screen failed',e));
})();
