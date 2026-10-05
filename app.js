const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY),$=id=>document.getElementById(id);let mode='login',session=null,profile=null,activeMatch=null,lastOpenedMatchId=null,lobbyStarted=false,lobbyLoading=false,lobbyInitToken=0,challengeRealtime=null,pendingRoomTabs=new Map(),initialAuthResolved=false,queuedAuthState=null,lobbyEnteringUserId=null;
function setSessionView(view){
 const loading=$('sessionLoadingView'),auth=$('authView'),lobby=$('lobbyView'),retry=$('sessionRetryBtn'),text=$('sessionLoadingText');
 loading?.classList.toggle('hidden',view!=='loading');
 auth?.classList.toggle('hidden',view!=='auth');
 lobby?.classList.toggle('hidden',view!=='lobby');
 if(view==='loading'){
   loading?.setAttribute('aria-busy','true');
   retry?.classList.add('hidden');
   if(text)text.textContent='Laster DartArena…';
   $('headerStatus').innerHTML='<i></i> Laster…';
 }
}
function showSessionError(message){
 setSessionView('loading');
 const loading=$('sessionLoadingView'),retry=$('sessionRetryBtn'),text=$('sessionLoadingText');
 loading?.setAttribute('aria-busy','false');
 if(text)text.textContent=message;
 retry?.classList.remove('hidden');
 if(retry)retry.onclick=()=>initializeAuth();
 $('headerStatus').innerHTML='<i></i> Tilkoblingsproblem';
}
function authMode(n){mode=n;const r=n==='register';$('loginTab').classList.toggle('active',!r);$('registerTab').classList.toggle('active',r);$('usernameLabel').classList.toggle('hidden',!r);$('username').required=r;$('authSubmit').textContent=r?'Opprett konto':'Logg inn';setMsg('')}function setMsg(t,c=''){$('authMessage').textContent=t;$('authMessage').className='message '+c}$('loginTab').onclick=()=>authMode('login');$('registerTab').onclick=()=>authMode('register');authMode('login');
$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('email').value.trim(),password=$('password').value,b=$('authSubmit');b.disabled=true;b.textContent=mode==='register'?'Oppretter…':'Logger inn…';setMsg('Jobber...');try{if(mode==='register'){const username=$('username').value.trim();if(username.length<2){setMsg('Fullt navn må ha minst 2 tegn.','error');return}const{data,error}=await db.auth.signUp({email,password,options:{data:{username,full_name:username}}});if(error)throw error;if(!data.session)setMsg('Konto opprettet. Sjekk e-posten din for bekreftelse.','ok')}else{const{error}=await db.auth.signInWithPassword({email,password});if(error)throw error}}catch(x){setMsg(x.message||'Noe gikk galt.','error')}finally{b.disabled=false;b.textContent=mode==='register'?'Opprett konto':'Logg inn'}};
$('logoutBtn').onclick=async()=>{const b=$('logoutBtn');if(b.disabled)return;b.disabled=true;b.textContent='Logger ut…';try{if(profile)await db.from('profiles').update({status:'unavailable',last_seen:new Date().toISOString()}).eq('id',profile.id);if(challengeRealtime)await db.removeChannel(challengeRealtime);challengeRealtime=null;lobbyStarted=false;profile=null;await db.auth.signOut()}catch(e){console.error('Logout failed',e);b.disabled=false;b.textContent='Logg ut'}};$('refreshBtn').onclick=manualRefresh;$('availabilityBtn').onclick=async()=>{if(!profile||activeMatch)return;const b=$('availabilityBtn'),next=profile.status==='available'?'unavailable':'available';b.disabled=true;b.textContent='Lagrer…';try{const{error}=await db.from('profiles').update({status:next,last_seen:new Date().toISOString()}).eq('id',profile.id);if(error)throw error;profile.status=next;renderAvailability();await loadPlayers()}catch(e){console.error('Availability update failed',e);alert('Kunne ikke oppdatere status: '+(e.message||e))}finally{renderAvailability()}};$('reopenMatchBtn').onclick=()=>activeMatch&&openMatch(activeMatch.id,true,activeMatch.game_variant);$('solo61Btn').onclick=()=>window.open('61.html','dartarena-training-61');
function renderAvailability(){const a=profile?.status==='available';$('availabilityBtn').textContent=activeMatch?'I kamp':a?'Available':'Unavailable';$('availabilityBtn').className='availability '+(a?'available':'unavailable');$('availabilityBtn').disabled=!!activeMatch}
async function manualRefresh(){if(!profile)return;const b=$('refreshBtn');if(b.disabled)return;const old=b.textContent;b.disabled=true;b.textContent='Oppdaterer…';try{await Promise.all([loadPlayers(),loadChallenges()])}catch(e){console.error('Manuell lobbyoppdatering feilet',e)}finally{b.textContent=old;b.disabled=false}}
async function enterLobby(s=session){
 if(!s?.user?.id)return showAuth();
 if(lobbyStarted&&profile?.id===s.user.id){setSessionView('lobby');return}
 if(lobbyEnteringUserId===s.user.id)return;
 lobbyEnteringUserId=s.user.id;
 const token=++lobbyInitToken;
 session=s;
 setSessionView('loading');
 const{data,error}=await db.from('profiles').select('*').eq('id',s.user.id).single();
 if(token!==lobbyInitToken||session?.user?.id!==s.user.id){if(lobbyEnteringUserId===s.user.id)lobbyEnteringUserId=null;return}
 if(error){if(lobbyEnteringUserId===s.user.id)lobbyEnteringUserId=null;showSessionError('Kunne ikke laste lobbyen. Kontroller nettet og prøv igjen.');console.error('Profile load failed',error);return}
 profile=data;
 lobbyStarted=true;
 setSessionView('lobby');
 $('welcomeName').textContent='Hei, '+profile.username;
 $('headerStatus').innerHTML='<i></i> Pålogget';
 const profileId=data.id;
 await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',profileId);
 if(token!==lobbyInitToken||profile?.id!==profileId)return;
 setupChallengeRealtime();
 if(lobbyEnteringUserId===s.user.id)lobbyEnteringUserId=null;
 await loadLobby();
}
function showAuth(){
 lobbyInitToken++;
 lobbyStarted=false;
 lobbyLoading=false;
 lobbyEnteringUserId=null;
 profile=null;
 activeMatch=null;
 setSessionView('auth');
 $('headerStatus').innerHTML='<i></i> Ikke innlogget';
}
function setupChallengeRealtime(){const profileId=profile?.id;if(!profileId)return;if(challengeRealtime)db.removeChannel(challengeRealtime);challengeRealtime=db.channel('lobby-challenges-'+profileId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'challenges',filter:`challenger_id=eq.${profileId}`},payload=>{const row=payload.new;if(row.status==='room')enterAcceptedRoom(row.id);loadChallenges()}).on('postgres_changes',{event:'INSERT',schema:'public',table:'challenges',filter:`challenged_id=eq.${profileId}`},()=>loadChallenges()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'challenges',filter:`challenged_id=eq.${profileId}`},()=>loadChallenges()).subscribe()}
function enterAcceptedRoom(id){let tab=pendingRoomTabs.get(id);if(tab&&!tab.closed){tab.location.href=`room.html?id=${encodeURIComponent(id)}`;pendingRoomTabs.delete(id);return}tab=window.open(`room.html?id=${encodeURIComponent(id)}`,`dartarena-room-${id}`);if(!tab)console.warn('Nettleseren blokkerte venteromfanen.');pendingRoomTabs.delete(id)}
async function findActiveMatch(profileId=profile?.id){if(!profileId)return null;const{data}=await db.from('matches').select('*').or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`).in('status',['waiting','playing']).order('created_at',{ascending:false}).limit(1);return data?.[0]||null}
async function loadLobby(){const profileId=profile?.id;if(!profileId||lobbyLoading)return;lobbyLoading=true;try{activeMatch=await findActiveMatch(profileId);if(profile?.id!==profileId)return;if(activeMatch){if(profile.status!=='in_game'){await db.from('profiles').update({status:'in_game'}).eq('id',profileId);if(profile?.id!==profileId)return;profile.status='in_game'}$('activeMatchCard').classList.remove('hidden');const opp=activeMatch.player1_id===profileId?activeMatch.player2_id:activeMatch.player1_id,{data:p}=await db.from('profiles').select('username').eq('id',opp).single();if(profile?.id!==profileId)return;const gameLabel=activeMatch.game_variant==='cricket'?'Cricket':activeMatch.game_variant==='half_it'?'Half-It':activeMatch.game_variant==='sixty_one'?'61':activeMatch.game,formatLabel=activeMatch.game_variant==='half_it'?'12 runder':activeMatch.game_variant==='sixty_one'?`Best of ${activeMatch.legs} • ${Math.round(Number(activeMatch.game_config?.duration_seconds||600)/60)} min/leg`:`Best of ${activeMatch.legs}`;$('activeMatchText').textContent=`Mot ${p?.username||'motstander'} • ${gameLabel} • ${formatLabel}`;if(lastOpenedMatchId!==activeMatch.id){lastOpenedMatchId=activeMatch.id;openMatch(activeMatch.id,false,activeMatch.game_variant)}}else{$('activeMatchCard').classList.add('hidden');if(profile.status==='in_game'){await db.from('profiles').update({status:'unavailable'}).eq('id',profileId);if(profile?.id!==profileId)return;profile.status='unavailable'}lastOpenedMatchId=null}renderAvailability();await Promise.all([loadPlayers(profileId),loadChallenges(profileId),checkMyAcceptedChallenge(profileId)])}finally{lobbyLoading=false}}
async function checkMyAcceptedChallenge(profileId=profile?.id){if(!profileId)return;const{data}=await db.from('challenges').select('id,status').eq('challenger_id',profileId).eq('status','room').order('created_at',{ascending:false}).limit(1);if(profile?.id!==profileId)return;const row=data?.[0];if(row)enterAcceptedRoom(row.id)}
function openMatch(id,manual,variant='x01'){const page=variant==='cricket'?'cricket.html':variant==='half_it'?'half-it.html':variant==='sixty_one'?'61-match.html':'match.html',w=window.open(`${page}?id=${encodeURIComponent(id)}`,`dartarena-match-${id}`);if(!w&&manual)alert('Nettleseren blokkerte kampfanen.');return w}
async function loadPlayers(profileId=profile?.id){if(!profileId)return;const{data,error}=await db.from('profiles').select('id,username,status,last_seen').neq('id',profileId).order('username');if(profile?.id!==profileId)return;if(error)return $('playerList').innerHTML=`<p class="muted">${esc(error.message)}</p>`;const now=Date.now(),online=(data||[]).filter(p=>p.last_seen&&now-new Date(p.last_seen).getTime()<300000);$('playerList').innerHTML=online.length?online.map(p=>{const can=!activeMatch&&p.status!=='in_game';return `<div class="player-row"><div class="player-main"><div class="avatar">${esc((p.username||'?')[0].toUpperCase())}</div><div><div class="player-name">${esc(p.username)}</div><div class="status"><span class="dot ${p.status}"></span>${p.status==='available'?'Available':p.status==='in_game'?'I kamp':'Unavailable'}</div></div></div><button class="small-btn challenge-btn" data-id="${p.id}" ${can?'':'disabled'}>Utfordre</button></div>`}).join(''):'<p class="muted">Ingen andre spillere er pålogget akkurat nå.</p>';document.querySelectorAll('.challenge-btn').forEach(b=>b.onclick=()=>sendInvite(b))}
async function sendInvite(button){if(activeMatch||!button||button.disabled)return;const id=button.dataset.id,old=button.textContent;button.disabled=true;button.textContent='Sender…';const waiting=window.open('about:blank','_blank');if(waiting){waiting.document.title='DartArena – venter';waiting.document.body.innerHTML='<div style="font-family:system-ui;background:#10151b;color:#fff;min-height:100vh;display:grid;place-items:center"><div>Venter på at motstanderen godtar…</div></div>'}const{data,error}=await db.from('challenges').insert({challenger_id:profile.id,challenged_id:id,game:501,legs:5,allow_draw:false,starter:'me',status:'pending'}).select('id').single();if(error){waiting?.close();button.disabled=false;button.textContent=old;return alert(error.message)}if(waiting)pendingRoomTabs.set(data.id,waiting);button.textContent='Sendt';setTimeout(()=>{if(button.isConnected&&!activeMatch){button.disabled=false;button.textContent=old}},1200)}
async function loadChallenges(profileId=profile?.id){if(!profileId)return;if(activeMatch)return $('challengeList').innerHTML='<p class="muted">Du er i kamp.</p>';const{data,error}=await db.from('challenges').select('id,challenger_id,status,created_at').eq('challenged_id',profileId).eq('status','pending').order('created_at',{ascending:false});if(profile?.id!==profileId)return;if(error)return $('challengeList').innerHTML=`<p class="muted">${esc(error.message)}</p>`;if(!data?.length)return $('challengeList').innerHTML='<p class="muted">Ingen ventende utfordringer.</p>';const ids=[...new Set(data.map(c=>c.challenger_id))],{data:people}=await db.from('profiles').select('id,username').in('id',ids);if(profile?.id!==profileId)return;const names=Object.fromEntries((people||[]).map(p=>[p.id,p.username]));$('challengeList').innerHTML=data.map(c=>`<div class="challenge-row"><div><div class="player-name">${esc(names[c.challenger_id]||'Spiller')}</div><div class="status">Vil koble til kamera og avtale kamp</div></div><div class="challenge-actions"><button class="small-btn accept" data-action="accepted" data-id="${c.id}">Godta</button><button class="small-btn decline" data-action="declined" data-id="${c.id}">Avslå</button></div></div>`).join('');document.querySelectorAll('.challenge-actions button').forEach(b=>b.onclick=()=>respondChallenge(b))}
async function respondChallenge(b){const id=b.dataset.id;if(b.dataset.action==='declined'){const old=b.textContent;b.disabled=true;b.textContent='Avslår…';const{error}=await db.from('challenges').update({status:'declined'}).eq('id',id);if(error){b.disabled=false;b.textContent=old;return alert(error.message)}return loadChallenges()}b.disabled=true;b.textContent='Kobler til…';const roomTab=window.open(`room.html?id=${encodeURIComponent(id)}`,`dartarena-room-${id}`);if(!roomTab){b.disabled=false;b.textContent='Godta';return alert('Nettleseren blokkerte venterommet. Tillat popup-vinduer for DartArena.')}const{error}=await db.from('challenges').update({status:'room'}).eq('id',id).eq('status','pending');if(error){roomTab.close();b.disabled=false;b.textContent='Godta';return alert(error.message)}await loadChallenges()}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}window.addEventListener('message',e=>{if(e.origin===location.origin&&profile)loadLobby()});

function handleAuthState(event,s){
 session=s;
 if(event==='SIGNED_OUT'||!s){showAuth();return}
 if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED'){
   if(!lobbyStarted||profile?.id!==s.user.id)enterLobby(s).catch(error=>{
     console.error('Lobby auth transition failed',error);
     if(session?.user?.id===s.user.id)showSessionError('Kunne ikke åpne lobbyen. Prøv igjen.')
   });
 }
}

db.auth.onAuthStateChange((event,s)=>{
 if(event==='INITIAL_SESSION')return;
 if(!initialAuthResolved){queuedAuthState={event,s};return}
 setTimeout(()=>handleAuthState(event,s),0);
});

async function initializeAuth(){
 setSessionView('loading');
 try{
   const{data,error}=await db.auth.getSession();
   if(error)throw error;
   session=data.session;
 }catch(error){
   console.error('Initial session check failed',error);
   initialAuthResolved=true;
   showSessionError('Kunne ikke kontrollere innloggingen. Prøv igjen.');
   return;
 }
 initialAuthResolved=true;
 if(queuedAuthState){
   const queued=queuedAuthState;
   queuedAuthState=null;
   return handleAuthState(queued.event,queued.s);
 }
 if(session)return enterLobby(session);
 showAuth();
}

initializeAuth().catch(error=>{
 console.error('Auth initialization failed',error);
 showSessionError('Kunne ikke starte DartArena. Prøv igjen.');
});
setInterval(()=>{if(profile){db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',profile.id);loadLobby()}},5000);
