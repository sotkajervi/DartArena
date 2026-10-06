const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id),tournamentMatchId=new URLSearchParams(location.search).get('id');
let tm=null,live=null,names={},mediaChannel=null,presence=null,liveChannel=null,mediaRequestTimer=null,tournamentChannel=null,tournamentId=null;
const subscriptions=new Map();


let statsMatchId=null,statsChannel=null,cricketStatsChannel=null,statsTimer=null,statsRequest=0,statsRows=null,cricketStatsRows=null,statsError=false;
const statsEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function cricketLiveStats(rows,pid){
  const mine=(rows||[]).filter(r=>r.player_id===pid),points=mine.reduce((sum,r)=>sum+Number(r.points_scored||0),0);
  let marks=0,darts=0;
  for(const row of mine){
    const visit=Array.isArray(row?.darts)?row.darts:[];
    for(const dart of visit){darts++;marks+=Math.max(0,Math.min(3,Number(dart?.mult)||0))}
  }
  return{visits:mine.length,points,mpr:darts?marks/darts*3:0};
}
function renderViewerStats(){
  const host=$('spectatorStats');if(!host||!tm)return;
  const chicago=String(live?.game_config?.chicago??'false').toLowerCase()==='true';
  const chicagoStage=Number(live?.game_config?.chicago_stage||live?.current_leg||1);
  const stageName=chicagoStage===1?'301 DIDO':chicagoStage===2?'CRICKET':'501 SIDO';
  $('spectatorStatsState').textContent=chicago?`CHICAGO • ${stageName}`:(tm.status==='finished'||live?.status==='finished'?'SLUTTSTATISTIKK':'HELE KAMPEN');
  if(!tm.live_match_id){host.innerHTML='<p class="muted">Statistikken vises når kampen starter.</p>';return}
  if(statsError){host.innerHTML='<p class="muted">Kunne ikke hente kampstatistikken. Prøver igjen…</p>';return}
  if(statsRows===null||cricketStatsRows===null){host.innerHTML='<p class="muted">Laster kampstatistikk…</p>';return}

  let rows=[];
  if(chicago&&chicagoStage===2){
    if(!cricketStatsRows.length){host.innerHTML='<p class="muted">Ingen Cricket-kast registrert ennå.</p>';return}
    const a=cricketLiveStats(cricketStatsRows,tm.player1_id),b=cricketLiveStats(cricketStatsRows,tm.player2_id);
    rows=[['MPR',a.mpr.toFixed(2),b.mpr.toFixed(2)],['Visits',a.visits,b.visits],['Poeng scoret',a.points,b.points],['Games',Number(live?.player1_legs||0),Number(live?.player2_legs||0)]];
  }else{
    const activeRows=chicago?statsRows.filter(r=>Number(r.leg_no||1)===chicagoStage):statsRows;
    if(!activeRows.length){host.innerHTML='<p class="muted">Ingen registrerte kast tilgjengelig ennå.</p>';return}
    const a=window.DartArenaX01Stats.statsFor(activeRows,tm.player1_id),b=window.DartArenaX01Stats.statsFor(activeRows,tm.player2_id);
    const baseRows=[['3-dart snitt',a.avg.toFixed(2),b.avg.toFixed(2)],['First 9 AVG',a.first9.toFixed(2),b.first9.toFixed(2)],['Høyeste checkout',a.high||'–',b.high||'–']];
    if(chicago)baseRows.push(['Visits',activeRows.filter(r=>r.player_id===tm.player1_id).length,activeRows.filter(r=>r.player_id===tm.player2_id).length]);
    else baseRows.push(['Raskeste leg',a.fast?a.fast+' piler':'–',b.fast?b.fast+' piler':'–']);
    rows=[...baseRows,['100+',a.c100,b.c100],['140+',a.c140,b.c140],['170+',a.c170,b.c170],['180',a.c180,b.c180]];
  }
  host.innerHTML='<table class="spectator-stats-table"><thead><tr><th scope="col">Statistikk</th><th scope="col">'+statsEsc(names[tm.player1_id]||'Spiller 1')+'</th><th scope="col">'+statsEsc(names[tm.player2_id]||'Spiller 2')+'</th></tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">'+r[0]+'</th><td>'+r[1]+'</td><td>'+r[2]+'</td></tr>').join('')+'</tbody></table>';
}
async function loadViewerStats(){
  const matchId=statsMatchId;if(!matchId)return;
  const request=++statsRequest;
  try{
    const [{data:throws,error:throwError},{data:cricket,error:cricketError}]=await Promise.all([
      db.from('match_throws').select('*').eq('match_id',matchId).order('created_at',{ascending:true}),
      db.from('cricket_visits').select('player_id,leg_no,darts,points_scored,created_at').eq('match_id',matchId).order('created_at',{ascending:true})
    ]);
    if(request!==statsRequest||matchId!==statsMatchId)return;
    if(throwError)throw throwError;
    if(cricketError)throw cricketError;
    statsRows=throws||[];cricketStatsRows=cricket||[];statsError=false;
  }catch(error){if(request!==statsRequest||matchId!==statsMatchId)return;statsError=true;console.error('Spectator statistics failed',error)}
  renderViewerStats();
}
function syncViewerStats(){
  const next=tm?.live_match_id||null;
  if(next!==statsMatchId){
    ++statsRequest;
    if(statsChannel)db.removeChannel(statsChannel);
    if(cricketStatsChannel)db.removeChannel(cricketStatsChannel);
    clearInterval(statsTimer);statsChannel=null;cricketStatsChannel=null;statsTimer=null;
    statsMatchId=next;statsRows=null;cricketStatsRows=null;statsError=false;
    if(next){
      statsChannel=db.channel('spectator-stats-'+next).on('postgres_changes',{event:'*',schema:'public',table:'match_throws',filter:'match_id=eq.'+next},loadViewerStats).subscribe(status=>{if(status==='SUBSCRIBED')loadViewerStats()});
      cricketStatsChannel=db.channel('spectator-cricket-stats-'+next).on('postgres_changes',{event:'*',schema:'public',table:'cricket_visits',filter:'match_id=eq.'+next},loadViewerStats).subscribe();
      // Re-fetch also covers missed reconnect events and deleted throws.
      statsTimer=setInterval(()=>{if(document.visibilityState!=='hidden')loadViewerStats()},5000);
      loadViewerStats();
    }
  }
  renderViewerStats();
}

function render(){
  if(!tm)return;
  syncViewerStats();
  const n1=names[tm.player1_id]||'Spiller 1',n2=names[tm.player2_id]||'Spiller 2';
  $('title').textContent=`${n1} vs ${n2}`;$('meta').textContent=`Best av ${tm.best_of} • ${tm.stage==='group'?'Puljespill':'Cup'}`;
  $('p1').textContent=n1;$('p2').textContent=n2;$('p1VideoName').textContent=n1;$('p2VideoName').textContent=n2;
  if(live){const chicago=String(live.game_config?.chicago??'false').toLowerCase()==='true',unit=chicago?'games':'legs';$('s1').textContent=Number(live.player1_score??501);$('s2').textContent=Number(live.player2_score??501);$('l1').textContent=`${Number(live.player1_legs||0)} ${unit}`;$('l2').textContent=`${Number(live.player2_legs||0)} ${unit}`}
  else{$('s1').textContent='–';$('s2').textContent='–';$('l1').textContent=`${Number(tm.player1_legs||0)} legs`;$('l2').textContent=`${Number(tm.player2_legs||0)} legs`}
  $('status').textContent=tm.status==='live'?'Kampen pågår live':tm.status==='finished'?'Kampen er ferdig':tm.status==='wo'?'Kampen er avgjort på WO':'Kampen er ikke startet ennå';
}
function videoTarget(pid){return pid===tm?.player1_id?{video:$('p1Video'),placeholder:$('p1Placeholder')}:{video:$('p2Video'),placeholder:$('p2Placeholder')}}
async function subscribePublication(pid,publication){
  if(!publication?.sessionId||![tm.player1_id,tm.player2_id].includes(pid))return;
  const existing=subscriptions.get(pid);if(existing?.sessionId===publication.sessionId)return;
  try{existing?.client?.close()}catch{}
  const client=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl),target=videoTarget(pid);subscriptions.set(pid,{client,sessionId:publication.sessionId});
  target.placeholder.textContent='Kobler til kamera…';target.placeholder.classList.remove('hidden');
  try{
    await client.subscribe(publication,async e=>{
      let rs=target.video.srcObject;if(!(rs instanceof MediaStream)){rs=new MediaStream();target.video.srcObject=rs}
      const tracks=e.streams?.[0]?.getTracks()||[e.track];for(const track of tracks){if(!rs.getTracks().some(t=>t.id===track.id))rs.addTrack(track)}
      target.video.muted=true;target.video.playsInline=true;await target.video.play().catch(()=>{});
      if(rs.getVideoTracks().some(t=>t.readyState==='live'))target.placeholder.classList.add('hidden');
    });
  }catch(e){console.error('Spectator subscribe failed',e);target.placeholder.textContent='Kunne ikke koble til kamera. Prøver igjen…';subscriptions.delete(pid);try{client.close()}catch{}}
}
async function requestMedia(){if(!mediaChannel)return;await mediaChannel.send({type:'broadcast',event:'spectator-request',payload:{at:Date.now()}}).catch(()=>{})}
async function setupMedia(session){
  if(!tm.live_match_id)return;
  mediaChannel=db.channel(`match-spectator-media-${tm.live_match_id}`).on('broadcast',{event:'spectator-publication'},({payload})=>subscribePublication(payload?.from,payload?.publication)).subscribe(async status=>{if(status==='SUBSCRIBED')await requestMedia()});
  clearInterval(mediaRequestTimer);mediaRequestTimer=setInterval(()=>{if(subscriptions.size<2)requestMedia()},2200);
  presence=db.channel(`match-viewers-${tm.live_match_id}`,{config:{presence:{key:session.user.id}}}).on('presence',{event:'sync'},renderPresence).on('presence',{event:'join'},renderPresence).on('presence',{event:'leave'},renderPresence).subscribe(async status=>{if(status==='SUBSCRIBED'){await presence.track({user_id:session.user.id,role:'spectator',online_at:new Date().toISOString()});renderPresence()}});
}
function renderPresence(){if(!presence)return;const viewers=Object.values(presence.presenceState()).flat().filter(x=>x.role==='spectator').length;$('viewerCount').textContent=String(viewers)}
async function loadLive(){
  if(!tm?.live_match_id)return;
  const {data,error}=await db.from('matches').select('*').eq('id',tm.live_match_id).single();
  if(!error&&data){live=data;render()}else console.error('Could not read live match for spectator',error);
  liveChannel=db.channel(`spectator-live-${tm.live_match_id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${tm.live_match_id}`},p=>{live=p.new;render();loadViewerStats()}).subscribe();
}
async function boot(){
  const {data:{session}}=await db.auth.getSession();if(!session||!tournamentMatchId)return location.replace('./');
  const {data,error}=await db.from('tournament_matches').select('*').eq('id',tournamentMatchId).single();if(error||!data)return location.replace('./');tm=data;tournamentId=tm.tournament_id;
  const {data:profiles}=await db.from('profiles').select('id,username').in('id',[tm.player1_id,tm.player2_id].filter(Boolean));names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));render();
  if(tm.status==='live'&&tm.live_match_id){await loadLive();await setupMedia(session)}
  tournamentChannel=db.channel(`spectator-tm-${tournamentMatchId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournament_matches',filter:`id=eq.${tournamentMatchId}`},p=>{tm=p.new;render();loadViewerStats()}).subscribe();
}
function closeViewer(){try{window.opener?.focus()}catch{};window.close();setTimeout(()=>{if(!window.closed&&tournamentId)location.href=`tournament.html?id=${encodeURIComponent(tournamentId)}`},120)}
$('closeBtn').onclick=closeViewer;
function cleanup(){++statsRequest;clearInterval(statsTimer);if(statsChannel){db.removeChannel(statsChannel);statsChannel=null}if(cricketStatsChannel){db.removeChannel(cricketStatsChannel);cricketStatsChannel=null}clearInterval(mediaRequestTimer);try{presence?.untrack()}catch{};for(const x of subscriptions.values()){try{x.client.close()}catch{}}subscriptions.clear();for(const ch of [mediaChannel,presence,liveChannel,tournamentChannel]){try{if(ch)db.removeChannel(ch)}catch{}}}
window.addEventListener('pagehide',cleanup);
boot().catch(e=>{console.error('Tilskuervisningen kunne ikke starte:',e);$('status').textContent='Kunne ikke starte tilskuervisningen.'});
