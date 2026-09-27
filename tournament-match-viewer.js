const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id),tournamentMatchId=new URLSearchParams(location.search).get('id');
let tm=null,live=null,names={},mediaChannel=null,presence=null,liveChannel=null,mediaRequestTimer=null,tournamentChannel=null,tournamentId=null;
const subscriptions=new Map();

function render(){
  if(!tm)return;
  const n1=names[tm.player1_id]||'Spiller 1',n2=names[tm.player2_id]||'Spiller 2';
  $('title').textContent=`${n1} vs ${n2}`;$('meta').textContent=`Best av ${tm.best_of} • ${tm.stage==='group'?'Puljespill':'Cup'}`;
  $('p1').textContent=n1;$('p2').textContent=n2;$('p1VideoName').textContent=n1;$('p2VideoName').textContent=n2;
  if(live){$('s1').textContent=Number(live.player1_score??501);$('s2').textContent=Number(live.player2_score??501);$('l1').textContent=`${Number(live.player1_legs||0)} legs`;$('l2').textContent=`${Number(live.player2_legs||0)} legs`}
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
  liveChannel=db.channel(`spectator-live-${tm.live_match_id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${tm.live_match_id}`},p=>{live=p.new;render()}).subscribe();
}
async function boot(){
  const {data:{session}}=await db.auth.getSession();if(!session||!tournamentMatchId)return location.replace('./');
  const {data,error}=await db.from('tournament_matches').select('*').eq('id',tournamentMatchId).single();if(error||!data)return location.replace('./');tm=data;tournamentId=tm.tournament_id;
  const {data:profiles}=await db.from('profiles').select('id,username').in('id',[tm.player1_id,tm.player2_id].filter(Boolean));names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));render();
  if(tm.status==='live'&&tm.live_match_id){await loadLive();await setupMedia(session)}
  tournamentChannel=db.channel(`spectator-tm-${tournamentMatchId}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournament_matches',filter:`id=eq.${tournamentMatchId}`},p=>{tm=p.new;render()}).subscribe();
}
function closeViewer(){try{window.opener?.focus()}catch{};window.close();setTimeout(()=>{if(!window.closed&&tournamentId)location.href=`tournament.html?id=${encodeURIComponent(tournamentId)}`},120)}
$('closeBtn').onclick=closeViewer;
function cleanup(){clearInterval(mediaRequestTimer);try{presence?.untrack()}catch{};for(const x of subscriptions.values()){try{x.client.close()}catch{}}subscriptions.clear();for(const ch of [mediaChannel,presence,liveChannel,tournamentChannel]){try{if(ch)db.removeChannel(ch)}catch{}}}
window.addEventListener('pagehide',cleanup);
boot().catch(e=>{console.error('Tilskuervisningen kunne ikke starte:',e);$('status').textContent='Kunne ikke starte tilskuervisningen.'});
