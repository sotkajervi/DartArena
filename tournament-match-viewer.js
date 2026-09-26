const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const VIEWER_BUILD='20260926-3';

console.info(`[DartArena spectator ${VIEWER_BUILD}]`,SUPABASE_URL);

const cleanSupabaseUrl=String(SUPABASE_URL).trim();
const cleanSupabaseKey=String(SUPABASE_KEY).trim();
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cleanSupabaseUrl)){
  throw new Error(`DartArena spectator: ugyldig Supabase URL (${JSON.stringify(cleanSupabaseUrl)})`);
}

const db=window.supabase.createClient(cleanSupabaseUrl,cleanSupabaseKey);
const $=(id)=>document.getElementById(id);
const matchId=new URLSearchParams(location.search).get('id');

let match=null;
let names={};
let presence=null;

function render(){
  if(!match)return;
  const player1=names[match.player1_id]||'Spiller 1';
  const player2=names[match.player2_id]||'Spiller 2';
  $('p1').textContent=player1;
  $('p2').textContent=player2;
  $('l1').textContent=Number(match.player1_legs||0);
  $('l2').textContent=Number(match.player2_legs||0);
  $('title').textContent=`${player1} vs ${player2}`;
  $('meta').textContent=`Best av ${match.best_of} • ${match.stage==='group'?'Puljespill':'Cup'}`;
  const statusText={live:'Kampen pågår live',finished:'Kampen er ferdig',wo:'Kampen er avgjort på WO',pending:'Kampen er ikke startet ennå'};
  $('status').textContent=statusText[match.status]||'Venter på kampstatus…';
}

function renderPresence(){
  if(!presence)return;
  const viewers=Object.values(presence.presenceState()).flat().filter((entry)=>entry.role==='spectator').length;
  $('viewerCount').textContent=viewers;
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!matchId){location.replace('./');return;}

  const {data,error}=await db.from('tournament_matches').select('*').eq('id',matchId).single();
  if(error||!data){console.error('Kunne ikke laste turneringskamp:',error);location.replace('./');return;}
  match=data;

  const {data:profiles,error:profileError}=await db.from('profiles').select('id,username').in('id',[match.player1_id,match.player2_id]);
  if(profileError)console.error('Kunne ikke laste spillernavn:',profileError);
  names=Object.fromEntries((profiles||[]).map((profile)=>[profile.id,profile.username]));
  render();

  db.channel(`tournament-match-watch-${matchId}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournament_matches',filter:`id=eq.${matchId}`},(event)=>{match=event.new;render();})
    .subscribe();

  const isPlayer=[match.player1_id,match.player2_id].includes(session.user.id);
  presence=db.channel(`tournament-match-viewers-${matchId}`,{config:{presence:{key:session.user.id}}});
  presence
    .on('presence',{event:'sync'},renderPresence)
    .on('presence',{event:'join'},renderPresence)
    .on('presence',{event:'leave'},renderPresence)
    .subscribe(async(status)=>{
      if(status!=='SUBSCRIBED')return;
      await presence.track({user_id:session.user.id,role:isPlayer?'player':'spectator',online_at:new Date().toISOString()});
      renderPresence();
    });
}

$('closeBtn').onclick=()=>{if(history.length>1)history.back();else location.href='./';};
window.addEventListener('pagehide',()=>{try{presence?.untrack();}catch(error){console.debug('Presence cleanup skipped:',error);}});
boot().catch((error)=>console.error('Tilskuervisningen kunne ikke starte:',error));
