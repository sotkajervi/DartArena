/* DartArena tournament readiness notifications. Only reads tournament data. */
(()=>{
if(window.__daReadyWatcher)return;
window.__daReadyWatcher=true;
const query=new URLSearchParams(location.search);
const tournamentPage=location.pathname.endsWith('/tournament.html');
const viewerPage=location.pathname.endsWith('/tournament-match-viewer.html');
const matchPage=location.pathname.endsWith('/match.html');
if(!tournamentPage&&!viewerPage&&!matchPage||!window.supabase)return;
const client=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',{auth:{persistSession:true,autoRefreshToken:false}});
let tournamentId=tournamentPage?query.get('id'):null,userId=null,previous=null,inflight=false,rows=[],overlay=null,ctx=null,soundArmed=false;
const done=s=>s==='finished'||s==='wo',live=s=>['live','playing','in_progress'].includes(s);
const style=document.createElement('style');
style.textContent=`.match-row.da-ready,.cup-match.da-ready{outline:2px solid #4bc878!important;outline-offset:-2px;border-radius:10px}.match-row.da-live,.cup-match.da-live{outline:2px solid #e9b749!important;outline-offset:-2px;border-radius:10px}.match-row.da-finished,.cup-match.da-finished{outline:2px solid #ed5c69!important;outline-offset:-2px;border-radius:10px}.da-ready-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,5,10,.77);display:grid;place-items:center;padding:16px;backdrop-filter:blur(5px)}.da-ready-card{background:linear-gradient(145deg,rgba(12,31,39,.98),rgba(5,16,25,.98));color:#e7f9ff;border:1px solid #20dfea;border-radius:16px;padding:28px 26px;max-width:460px;width:min(100%,460px);text-align:center;box-shadow:0 0 0 1px rgba(38,237,247,.12),0 0 32px rgba(0,213,229,.16),0 22px 60px rgba(0,0,0,.45)}.da-ready-card h2{margin:0 0 12px;color:#67f1ff;font-size:clamp(21px,4vw,25px);font-weight:850;letter-spacing:.01em;text-shadow:0 0 18px rgba(18,224,243,.16)}.da-ready-card p{margin:0 0 19px;color:#dcf5fa;line-height:1.5}.da-ready-card a,.da-ready-card button{display:inline-block;margin:5px;padding:11px 17px;font:inherit;font-weight:800;border-radius:9px;background:#00d1de;color:#00232c;border:1px solid #19e4ee;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s}.da-ready-card a:hover,.da-ready-card a:focus-visible{background:#43edf6;box-shadow:0 0 16px rgba(0,221,239,.28)}.da-ready-card button{background:#102c37;border:1px solid rgba(42,220,235,.55);color:#d9f9fc}.da-ready-card button:hover,.da-ready-card button:focus-visible{background:#174453;border-color:#36e8f4}.da-ready-card a:focus-visible,.da-ready-card button:focus-visible{outline:2px solid #fff;outline-offset:3px}@media(max-width:420px){.da-ready-card{padding:23px 15px}.da-ready-card a,.da-ready-card button{padding:11px 14px}}`;
document.head.append(style);
function arm(){soundArmed=true;try{const C=window.AudioContext||window.webkitAudioContext;if(C){ctx ||= new C();ctx.resume().catch(()=>{})}}catch{}}
document.addEventListener('pointerdown',arm,{passive:true});
document.addEventListener('keydown',arm);
function sound(){if(!soundArmed||!ctx)return;try{ctx.resume().catch(()=>{});[0,.2,.4].forEach((t,i)=>{const start=ctx.currentTime+t,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=[659,784,988][i];g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(.1,start+.015);g.gain.exponentialRampToValueAtTime(.0001,start+.17);o.connect(g).connect(ctx.destination);o.start(start);o.stop(start+.18)})}catch{}}
// Never offer a later round while either player has unfinished earlier matches.
function eligibleForRound(match,all=rows){
  const round=Number(match?.round_no);
  const number=Number(match?.match_no);
  if(!match||match.status!=='pending'||!['group','cup'].includes(match.stage)||
     !Number.isInteger(round)||round<1||!Number.isInteger(number)||number<1||
     !match.player1_id||!match.player2_id)return false;
  const players=[match.player1_id,match.player2_id];
  if(all.some(m=>m.id!==match.id&&live(m.status)&&
      players.some(id=>m.player1_id===id||m.player2_id===id)))return false;
  for(const id of players){
    if(all.some(m=>m.id!==match.id&&m.stage===match.stage&&
        (match.stage!=='group'||m.group_id===match.group_id)&&
        (m.player1_id===id||m.player2_id===id)&&
        (Number(m.round_no)<round||
          (Number(m.round_no)===round&&Number(m.match_no)<number))&&
        !done(m.status)))return false;
  }
  // Cup advancement must be supported by both preceding bracket results.
  if(match.stage==='cup'&&round>1){
    const prior=all.filter(m=>m.stage==='cup'&&Number(m.round_no)===round-1&&
      (Number(m.match_no)===number*2-1||Number(m.match_no)===number*2));
    if(prior.length!==2||prior.some(m=>!done(m.status)||!players.includes(m.winner_id))||
      new Set(prior.map(m=>m.winner_id)).size!==2)return false;
  }
  return true;
}
function alertReady(match){overlay?.remove();overlay=document.createElement('div');overlay.className='da-ready-overlay';overlay.setAttribute('role','alertdialog');overlay.setAttribute('aria-modal','true');const card=document.createElement('div');card.className='da-ready-card';const title=document.createElement('h2');title.textContent=match.stage==='cup'?`Din cupkamp i runde ${match.round_no} er klar!`:`Din puljekamp i runde ${match.round_no} er klar!`;const text=document.createElement('p');text.textContent='Motstanderen din er ledig. Dere kan starte kampen.';const link=document.createElement('a');link.href='tournament-match-room.html?id='+encodeURIComponent(match.id);link.textContent='Til venterom';link.addEventListener('click',async e=>{
  e.preventDefault();
  link.style.pointerEvents='none';
  try{
    const [{data:all,error},{data:tournament}]=await Promise.all([
      client.from('tournament_matches')
        .select('id,stage,group_id,round_no,match_no,status,player1_id,player2_id,winner_id')
        .eq('tournament_id',tournamentId),
      client.from('tournaments').select('status').eq('id',tournamentId).maybeSingle()
    ]);
    const current=(all||[]).find(m=>m.id===match.id);
    const activeStage=tournament?.status==='cup'?'cup':tournament?.status==='groups'?'group':null;
    if(error||!current||current.stage!==activeStage||
      ![current.player1_id,current.player2_id].includes(userId)||!eligibleForRound(current,all)){
      text.textContent='Kampen er ikke klar i riktig runde ennå. Åpne turneringen for oppdatert status.';
      link.href='tournament.html?id='+encodeURIComponent(tournamentId);
      link.textContent='Åpne turneringen';
      return;
    }
    location.assign('tournament-match-room.html?id='+encodeURIComponent(current.id));
  }catch(err){
    console.warn('Tournament ready validation failed',err);
    text.textContent='Kunne ikke kontrollere om kampen er klar. Åpne turneringen.';
    link.href='tournament.html?id='+encodeURIComponent(tournamentId);
    link.textContent='Åpne turneringen';
  }finally{link.style.pointerEvents='auto'}
});const close=document.createElement('button');close.textContent='Lukk';close.onclick=()=>{overlay.remove();overlay=null};card.append(title,text,link,close);overlay.append(card);document.body.append(overlay);sound()}
function colors(){if(!tournamentPage)return;const busy=new Set(rows.filter(m=>live(m.status)).flatMap(m=>[m.player1_id,m.player2_id]));const map=new Map(rows.map(m=>[m.id,m]));document.querySelectorAll('.match-row[data-match],.cup-match[data-match]').forEach(el=>{const m=map.get(el.dataset.match);if(!m)return;el.classList.toggle('da-finished',done(m.status));el.classList.toggle('da-live',live(m.status));el.classList.toggle('da-ready',eligibleForRound(m,rows))})}
async function resolve(){if(tournamentId)return tournamentId;const id=query.get('tournamentMatch')||(viewerPage?query.get('id'):null);if(id){const {data}=await client.from('tournament_matches').select('tournament_id').eq('id',id).maybeSingle();tournamentId=data?.tournament_id||null}else if(matchPage&&query.get('id')){const {data}=await client.from('tournament_matches').select('tournament_id').eq('live_match_id',query.get('id')).limit(1).maybeSingle();tournamentId=data?.tournament_id||null}return tournamentId}
async function refresh(){if(inflight||!tournamentId||!userId)return;inflight=true;try{const [{data,error},{data:t}]=await Promise.all([client.from('tournament_matches').select('id,stage,group_id,status,round_no,match_no,player1_id,player2_id,winner_id').eq('tournament_id',tournamentId),client.from('tournaments').select('status').eq('id',tournamentId).maybeSingle()]);if(error||!data)return;rows=data;colors();if(!['groups','cup'].includes(t?.status)){previous=null;return}const candidate=rows.filter(m=>m.stage===(t.status==='cup'?'cup':'group')&&(m.player1_id===userId||m.player2_id===userId)&&eligibleForRound(m,rows)).sort((a,b)=>a.round_no-b.round_no||a.match_no-b.match_no)[0];const next=candidate?.id||null;if(next&&next!==previous)alertReady(candidate);previous=next}catch(e){console.warn('Group ready watcher:',e)}finally{inflight=false}}
async function init(){const {data:{session}}=await client.auth.getSession();userId=session?.user?.id;if(!userId||!await resolve())return;if(tournamentPage){for(const target of [document.getElementById('liveGroups'),document.getElementById('cupBracket')])if(target)new MutationObserver(colors).observe(target,{childList:true,subtree:true})}await refresh();const timer=setInterval(refresh,7000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true})}
init().catch(e=>console.warn('Group ready watcher init:',e));
})();