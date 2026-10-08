const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
const TOURNAMENT_GAMES=[170,301,501,1001];
const TOURNAMENT_VARIANTS=['x01','chicago'];

let me=null;
let tournament=null;
let members=[];
let names={};
let drawnGroups=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getDialog(){for(let i=0;i<40&&!window.DartArenaDialog;i++)await sleep(50);return window.DartArenaDialog||null}

function esc(v=''){
  return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmt(d){
  return new Intl.DateTimeFormat('nb-NO',{dateStyle:'full',timeStyle:'short'}).format(new Date(d));
}
function statusText(s){
  return ({registration:'Påmelding åpen',groups_setup:'Klargjør puljer',groups:'Puljespill',cup_setup:'Klargjør cup',cup:'Cup',finished:'Ferdig',cancelled:'Avbrutt'})[s]||s;
}
function getParticipants(){
  return members.filter(x=>x.role==='participant');
}
function validTournamentGame(value){
  return TOURNAMENT_GAMES.includes(Number(value));
}
function tournamentIsChicago(t=tournament){
  return String(t?.game_variant||'x01').toLowerCase()==='chicago';
}
function tournamentCupIsChicago(t=tournament){
  return String(t?.cup_game_variant||t?.game_variant||'x01').toLowerCase()==='chicago';
}
function formatGameLabel(game,variant){
  if(String(variant||'x01').toLowerCase()==='chicago')return'Chicago Style';
  return String(validTournamentGame(game)?Number(game):501);
}
function tournamentGameLabel(t=tournament){
  return formatGameLabel(t?.game,t?.game_variant);
}
function tournamentCupGameLabel(t=tournament){
  return formatGameLabel(t?.cup_game??t?.game,t?.cup_game_variant??t?.game_variant);
}
function tournamentTypeLabel(t){
  return t.tournament_type==='groups_cup'?'Puljer + cup':'Ren cup';
}
function tournamentMeta(t){
  if(t.tournament_type==='groups_cup'){
    return `${tournamentTypeLabel(t)} • Puljer: ${tournamentGameLabel(t)} • Cup: ${tournamentCupGameLabel(t)} • ${fmt(t.starts_at)}`;
  }
  return `${tournamentTypeLabel(t)} • ${tournamentCupGameLabel(t)} • ${fmt(t.starts_at)}`;
}

function showTournamentUnavailable(message='Turneringen finnes ikke lenger.'){
  tournament=null;
  $('tName').textContent='Turnering utilgjengelig';
  $('tMeta').textContent='';
  $('tStatus').textContent='Utilgjengelig';
  $('tInfo').textContent=message;
  $('participantTitle').textContent='Påmeldte';
  $('participantList').innerHTML='<p class="muted">Gå tilbake til hovedlobbyen.</p>';
  ['joinBtn','leaveBtn','ownerActions','groupSetup','groupLobby','cupSetup','cupLobby'].forEach(key=>$(key)?.classList.add('hidden'));
  document.getElementById('tournamentGameField')?.remove();
  document.getElementById('tournamentCupGameField')?.remove();
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){location.href='index.html';return;}
  me=session.user.id;
  if(!id){location.href='index.html';return;}

  $('backBtn').onclick=()=>location.href='index.html';
  $('joinBtn').onclick=join;
  $('leaveBtn').onclick=leave;
  $('closeRegistrationBtn').onclick=closeRegistration;
  $('cancelTournamentBtn').onclick=cancelTournament;
  $('drawGroupsBtn').onclick=drawGroups;
  $('redrawGroupsBtn').onclick=drawGroups;
  $('startGroupsBtn').onclick=startGroups;
  $('groupCount').onchange=()=>{drawnGroups=null;renderSetup();};
  $('advanceCount').onchange=()=>{drawnGroups=null;renderSetup();};
  $('groupBestOf').onchange=()=>{drawnGroups=null;renderSetup();};

  db.channel('tournament-'+id)
    .on('postgres_changes',{event:'*',schema:'public',table:'tournaments',filter:`id=eq.${id}`},load)
    .on('postgres_changes',{event:'*',schema:'public',table:'tournament_members',filter:`tournament_id=eq.${id}`},load)
    .on('postgres_changes',{event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${id}`},()=>{
      if(tournament?.status==='groups'||(tournament?.status==='finished'&&tournament?.tournament_type==='groups_cup'))loadGroupLobby();
    })
    .subscribe();

  await load();
}

async function load(){
  const {data:t,error}=await db.from('tournaments').select('*').eq('id',id).maybeSingle();
  if(error){
    console.error('Tournament load failed',error);
    showTournamentUnavailable('Turneringen kunne ikke lastes akkurat nå.');
    return;
  }
  if(!t){
    showTournamentUnavailable('Turneringen finnes ikke lenger eller er slettet.');
    return;
  }

  tournament=t;
  const {data:m,error:memberError}=await db.from('tournament_members')
    .select('user_id,role,joined_at')
    .eq('tournament_id',id)
    .order('joined_at');
  if(memberError){
    console.error('Tournament members load failed',memberError);
    members=[];
  }else{
    members=m||[];
  }

  const ids=[...new Set([t.owner_id,...members.map(x=>x.user_id)].filter(Boolean))];
  if(ids.length){
    const {data:p,error:profileError}=await db.from('profiles').select('id,username').in('id',ids);
    if(profileError)console.error('Tournament profiles load failed',profileError);
    else names={...names,...Object.fromEntries((p||[]).map(x=>[x.id,x.username]))};
  }

  renderPage();
  if(t.status==='groups'||(t.status==='finished'&&t.tournament_type==='groups_cup'))await loadGroupLobby();
  window.dispatchEvent(new CustomEvent('dartarena:tournament-loaded',{detail:{id:t.id,status:t.status,gameVariant:t.game_variant||'x01',cupGameVariant:t.cup_game_variant||t.game_variant||'x01'}}));
}

function renderPage(){
  const t=tournament;
  if(!t)return;
  const participants=getParticipants();
  $('tName').textContent=t.name;
  $('tMeta').textContent=tournamentMeta(t);
  $('tStatus').textContent=statusText(t.status);
  $('participantTitle').textContent=`Påmeldte (${participants.length})`;

  const ownerJoined=participants.some(x=>x.user_id===t.owner_id);
  const rows=[
    {user_id:t.owner_id,role:'owner',playing:ownerJoined},
    ...participants.filter(x=>x.user_id!==t.owner_id).map(x=>({...x,playing:true}))
  ];
  $('participantList').innerHTML=rows.map(x=>`<div class="player-row"><div class="player-main"><div class="avatar">${esc((names[x.user_id]||'?')[0].toUpperCase())}</div><div><div class="player-name ${x.role==='owner'?'role-admin':'role-participant'}">${esc(names[x.user_id]||'Spiller')}</div><div class="status">${x.role==='owner'?(x.playing?'Turneringsleder • Påmeldt':'Turneringsleder • Ikke påmeldt'):'Deltaker'}</div></div></div></div>`).join('');

  const joined=members.some(x=>x.role==='participant'&&x.user_id===me);
  const owner=t.owner_id===me;
  const open=t.registration_open&&t.status==='registration';
  const active=!['finished','cancelled'].includes(t.status);
  $('joinBtn').classList.toggle('hidden',!open||joined);
  $('leaveBtn').classList.toggle('hidden',!open||!joined);
  $('ownerActions').classList.toggle('hidden',!owner||!active);
  $('closeRegistrationBtn').classList.toggle('hidden',!open);
  $('groupSetup').classList.toggle('hidden',!(owner&&t.status==='groups_setup'));
  $('groupLobby').classList.toggle('hidden',!(t.status==='groups'||(t.status==='finished'&&t.tournament_type==='groups_cup')));

  if(t.status==='cancelled')$('tInfo').textContent='Turneringen er avbrutt av turneringsleder.';
  else if(open)$('tInfo').textContent='Spillere og turneringsleder kan melde seg på og av frem til påmeldingen stenges.';
  else if(t.status==='groups_setup')$('tInfo').textContent='Påmeldingen er stengt. Turneringsleder velger spill og setter opp puljene.';
  else if(t.status==='cup_setup')$('tInfo').textContent='Påmeldingen er stengt. Turneringsleder velger spill og setter opp cupen.';
  else if(t.status==='groups')$('tInfo').textContent='Puljespillet er i gang. Tabeller og kamper oppdateres live.';
  else $('tInfo').textContent='Påmeldingen er stengt.';

  ensureTournamentGameSelector(owner);
  if(owner&&t.status==='groups_setup')renderSetup();
}

function syncTournamentGameUi(){
  const groupChicago=tournamentIsChicago();
  const cupChicago=tournamentCupIsChicago();
  const bestField=$('groupBestOf')?.closest('label');
  if(bestField)bestField.classList.toggle('hidden',groupChicago);

  const groupHelp=document.getElementById('tournamentGameHelp');
  if(groupHelp)groupHelp.textContent=groupChicago
    ?'301 DIDO • Cricket • 501 SIDO • først til 2 games'
    :'X01 • velg Best av legs for puljekampene';

  const cupHelp=document.getElementById('tournamentCupGameHelp');
  if(cupHelp)cupHelp.textContent=cupChicago
    ?'Chicago Style i cup • fast først til 2 games'
    :`${tournamentCupGameLabel()} • Best of velges separat per cuprunde`;

  const groupHelpText=$('groupLobby')?.querySelector('.muted.compact');
  if(groupHelpText)groupHelpText.textContent=groupChicago
    ?'Trykk på en kamp for kamprom, tilskuervisning eller statistikk. Rangering: kampseire → game-differanse → vunne games → innbyrdes.'
    :'Trykk på en kamp for kamprom, tilskuervisning eller statistikk. Rangering: kampseire → leg-differanse → vunne legs → innbyrdes.';
}

function gameOptions(){
  return '<option value="170">170</option><option value="301">301</option><option value="501">501</option><option value="1001">1001</option><option value="chicago">Chicago Style</option>';
}

function setFormatSelectValue(select,game,variant){
  if(!select)return;
  select.value=String(variant||'x01').toLowerCase()==='chicago'?'chicago':String(validTournamentGame(game)?Number(game):501);
}

function ensureFormatField({id,selectId,helpId,label,anchor,game,variant,onchange}){
  if(!anchor)return null;
  let field=document.getElementById(id);
  if(!field){
    field=document.createElement('label');
    field.id=id;
    field.className='field';
    field.innerHTML=`<span>${label}</span><select id="${selectId}">${gameOptions()}</select><small id="${helpId}" style="display:block;margin-top:7px;letter-spacing:0;text-transform:none;color:var(--muted)"></small>`;
    anchor.insertAdjacentElement('beforebegin',field);
    field.querySelector('select').onchange=onchange;
  }else if(field.nextElementSibling!==anchor){
    anchor.insertAdjacentElement('beforebegin',field);
  }
  const select=field.querySelector('select');
  setFormatSelectValue(select,game,variant);
  return field;
}

function ensureTournamentGameSelector(owner){
  const groupField=document.getElementById('tournamentGameField');
  const cupField=document.getElementById('tournamentCupGameField');
  const setupStatus=tournament?.status==='groups_setup'||tournament?.status==='cup_setup';
  if(!owner||!setupStatus){
    groupField?.remove();
    cupField?.remove();
    syncTournamentGameUi();
    return;
  }

  if(tournament.status==='groups_setup'&&tournament.tournament_type==='groups_cup'){
    const anchor=$('groupCount')?.closest('label');
    if(!anchor)return;
    ensureFormatField({
      id:'tournamentCupGameField',selectId:'tournamentCupGame',helpId:'tournamentCupGameHelp',
      label:'Cupspill',anchor,game:tournament.cup_game??501,variant:tournament.cup_game_variant??'x01',
      onchange:event=>saveTournamentFormat(event.currentTarget,'cup')
    });
    ensureFormatField({
      id:'tournamentGameField',selectId:'tournamentGame',helpId:'tournamentGameHelp',
      label:'Puljespill',anchor:document.getElementById('tournamentCupGameField')||anchor,
      game:tournament.game,variant:tournament.game_variant,
      onchange:event=>saveTournamentFormat(event.currentTarget,'group')
    });
  }else{
    groupField?.remove();
    const anchor=$('buildCupBtn');
    if(!anchor)return;
    ensureFormatField({
      id:'tournamentCupGameField',selectId:'tournamentCupGame',helpId:'tournamentCupGameHelp',
      label:'Cupspill',anchor,game:tournament.cup_game??tournament.game,variant:tournament.cup_game_variant??tournament.game_variant,
      onchange:event=>saveTournamentFormat(event.currentTarget,'cup')
    });
  }
  syncTournamentGameUi();
}

async function saveTournamentFormat(select,scope){
  if(!tournament||tournament.owner_id!==me||!select)return;
  const chicago=select.value==='chicago';
  const game=chicago?501:Number(select.value);
  const gameVariant=chicago?'chicago':'x01';
  if(!chicago&&!validTournamentGame(game))return;

  const isCup=scope==='cup';
  const previousGame=isCup?Number(tournament.cup_game??tournament.game)||501:Number(tournament.game)||501;
  const previousVariant=isCup?String((tournament.cup_game_variant??tournament.game_variant) || 'x01'):String(tournament.game_variant||'x01');
  const update=isCup
    ?{cup_game:game,cup_game_variant:gameVariant,updated_at:new Date().toISOString()}
    :{game,game_variant:gameVariant,updated_at:new Date().toISOString()};

  // Ren cup keeps legacy game fields aligned as well.
  if(isCup&&tournament.tournament_type==='cup'){
    update.game=game;
    update.game_variant=gameVariant;
  }

  select.disabled=true;
  try{
    const {error}=await db.from('tournaments')
      .update(update)
      .eq('id',id)
      .eq('owner_id',me)
      .eq('status',tournament.status);
    if(error)throw error;

    if(isCup){
      tournament.cup_game=game;
      tournament.cup_game_variant=gameVariant;
      if(tournament.tournament_type==='cup'){
        tournament.game=game;
        tournament.game_variant=gameVariant;
      }
    }else{
      tournament.game=game;
      tournament.game_variant=gameVariant;
      drawnGroups=null;
    }

    $('tMeta').textContent=tournamentMeta(tournament);
    syncTournamentGameUi();
    if(tournament.status==='groups_setup')renderSetup();
  }catch(error){
    console.error('Tournament game update failed',error);
    setFormatSelectValue(select,previousGame,previousVariant);
    syncTournamentGameUi();
    alert('Kunne ikke lagre spillvalg: '+(error.message||error));
  }finally{
    select.disabled=false;
  }
}

async function saveTournamentGame(select){
  return saveTournamentFormat(select,'group');
}

function renderSetup(){
  const n=getParticipants().length;
  const g=$('groupCount');
  ensureTournamentGameSelector(tournament?.owner_id===me);
  if(!g.options.length){
    const opts=[];
    for(let x=1;x<=Math.min(n,16);x++)opts.push(`<option value="${x}">${x} ${x===1?'pulje':'puljer'}</option>`);
    g.innerHTML=opts.join('')||'<option value="1">1 pulje</option>';
  }
  syncTournamentGameUi();
  const gc=Number(g.value||1);
  const a=$('advanceCount');
  const old=a.value;
  const maxPer=Math.max(1,Math.ceil(n/gc));
  let adv='<option value="all">Alle videre</option>';
  for(let x=1;x<=maxPer;x++)adv+=`<option value="${x}">Topp ${x} fra hver pulje</option>`;
  a.innerHTML=adv;
  if([...a.options].some(o=>o.value===old))a.value=old;
  $('drawState').textContent=drawnGroups?'Trekkingen er klar':'Ikke trukket';
  $('drawGroupsBtn').classList.toggle('hidden',!!drawnGroups);
  $('redrawGroupsBtn').classList.toggle('hidden',!drawnGroups);
  $('startGroupsBtn').classList.toggle('hidden',!drawnGroups);
  $('startGroupsBtn').textContent='Start puljespill';
  if(!drawnGroups)$('groupPreview').innerHTML='<p class="muted">Puljene vises her etter trekning.</p>';
  else renderGroups();
}

function shuffled3(arr){
  let out=[...arr];
  for(let r=0;r<3;r++){
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
  }
  return out;
}

function drawGroups(){
  const players=shuffled3(getParticipants());
  const count=Number($('groupCount').value);
  drawnGroups=Array.from({length:count},()=>[]);
  players.forEach((p,i)=>drawnGroups[i%count].push(p));
  renderSetup();
}

function renderGroups(){
  $('groupPreview').innerHTML=drawnGroups.map((group,i)=>`<div class="player-row" style="display:block"><div class="player-name" style="color:var(--cyan);margin-bottom:8px">Pulje ${i+1}</div>${group.map((p,j)=>`<div class="status" style="padding:5px 0;color:var(--text)">${j+1}. ${esc(names[p.user_id]||'Spiller')}</div>`).join('')}</div>`).join('');
}

function roundRobin(players){
  let a=players.map(p=>p.user_id);
  if(a.length%2)a.push(null);
  const rounds=[];
  for(let r=0;r<a.length-1;r++){
    const games=[];
    for(let i=0;i<a.length/2;i++){
      const p1=a[i],p2=a[a.length-1-i];
      if(p1&&p2)games.push([p1,p2]);
    }
    rounds.push(games);
    a=[a[0],a[a.length-1],...a.slice(1,-1)];
  }
  return rounds;
}

function standings(players,matches){
  const s=Object.fromEntries(players.map(p=>[p.user_id,{id:p.user_id,w:0,lf:0,la:0,d:0}]));
  matches.filter(m=>['finished','wo'].includes(m.status)).forEach(m=>{
    if(!s[m.player1_id]||!s[m.player2_id])return;
    const a=Number(m.player1_legs||0),b=Number(m.player2_legs||0);
    s[m.player1_id].lf+=a;s[m.player1_id].la+=b;
    s[m.player2_id].lf+=b;s[m.player2_id].la+=a;
    if(m.winner_id&&s[m.winner_id])s[m.winner_id].w++;
  });
  Object.values(s).forEach(x=>x.d=x.lf-x.la);
  return Object.values(s).sort((a,b)=>b.w-a.w||b.d-a.d||b.lf-a.lf||headToHead(a.id,b.id,matches)||String(names[a.id]||'').localeCompare(String(names[b.id]||'')));
}

function headToHead(a,b,matches){
  const m=matches.find(x=>['finished','wo'].includes(x.status)&&((x.player1_id===a&&x.player2_id===b)||(x.player1_id===b&&x.player2_id===a)));
  if(!m?.winner_id)return 0;
  return m.winner_id===a?-1:m.winner_id===b?1:0;
}

async function groupMatchAverages(matches){
  if(tournamentIsChicago())return new Map();
  const completed=(matches||[]).filter(m=>m.status==='finished'&&!m.is_wo&&m.live_match_id);
  const liveIds=[...new Set(completed.map(m=>m.live_match_id).filter(Boolean))];
  if(!liveIds.length)return new Map();
  const {data:visits,error}=await db.from('match_throws')
    .select('match_id,player_id,score,is_checkout,darts_used')
    .in('match_id',liveIds);
  if(error){console.warn('Could not load group match averages',error);return new Map()}
  const tournamentByLive=new Map(completed.map(m=>[m.live_match_id,m]));
  const totals=new Map();
  for(const visit of visits||[]){
    const tm=tournamentByLive.get(visit.match_id);
    if(!tm||![tm.player1_id,tm.player2_id].includes(visit.player_id))continue;
    const key=`${tm.id}:${visit.player_id}`;
    const row=totals.get(key)||{score:0,darts:0};
    row.score+=Number(visit.score||0);
    row.darts+=visit.is_checkout?Math.max(1,Number(visit.darts_used||3)):3;
    totals.set(key,row);
  }
  const out=new Map();
  for(const tm of completed){
    for(const playerId of [tm.player1_id,tm.player2_id].filter(Boolean)){
      const row=totals.get(`${tm.id}:${playerId}`);
      if(row?.darts)out.set(`${tm.id}:${playerId}`,row.score/row.darts*3);
    }
  }
  return out;
}

async function loadGroupLobby(){
  const [{data:groups,error:ge},{data:players,error:pe},{data:matches,error:me2}]=await Promise.all([
    db.from('tournament_groups').select('*').eq('tournament_id',id).order('group_no'),
    db.from('tournament_group_players').select('*').eq('tournament_id',id).order('seed_no'),
    db.from('tournament_matches').select('*').eq('tournament_id',id).eq('stage','group').order('round_no').order('match_no')
  ]);
  if(ge||pe||me2){console.error(ge||pe||me2);return;}
  const liveIds=[...new Set(matches.filter(m=>m.status==='live'&&m.live_match_id).map(m=>m.live_match_id))];
  if(liveIds.length){
    const {data:liveRows,error:liveError}=await db.from('matches')
      .select('id,player1_legs,player2_legs')
      .in('id',liveIds);
    if(liveError)console.warn('Could not load live tournament scores',liveError);
    else{
      const liveById=new Map((liveRows||[]).map(row=>[row.id,row]));
      matches.forEach(match=>{
        const live=liveById.get(match.live_match_id);
        if(live){
          match._live_player1_legs=Number(live.player1_legs||0);
          match._live_player2_legs=Number(live.player2_legs||0);
        }
      });
    }
  }
  const userIds=[...new Set(players.map(p=>p.user_id))];
  const missing=userIds.filter(uid=>!names[uid]);
  if(missing.length){
    const {data:p}=await db.from('profiles').select('id,username').in('id',missing);
    Object.assign(names,Object.fromEntries((p||[]).map(x=>[x.id,x.username])));
  }
  const groupAvgs=await groupMatchAverages(matches);
  for(const match of matches){
    match._player1_avg=groupAvgs.get(`${match.id}:${match.player1_id}`)??null;
    match._player2_avg=groupAvgs.get(`${match.id}:${match.player2_id}`)??null;
  }
  const done=matches.filter(m=>['finished','wo'].includes(m.status)).length;
  const archive=tournament?.status==='finished';
  $('groupLobby')?.classList.toggle('group-archive-full',archive);
  const groupLabel=$('groupLobby')?.querySelector('.heading small');
  if(groupLabel)groupLabel.textContent=archive?'PULJEHISTORIKK':'LIVE';
  $('groupProgress').textContent=archive?`${matches.length} puljekamper`:`${done} / ${matches.length} kamper ferdig`;
  const collapseArchivedGroups=archive&&groups.length>=2;
  $('liveGroups').innerHTML=groups.map(g=>{
    const gp=players.filter(p=>p.group_id===g.id);
    const gm=matches.filter(m=>m.group_id===g.id);
    const table=standings(gp,gm);
    const qualify=g.advance_mode==='all'?table.length:Number(g.advance_count||0);
    const rounds=[...new Set(gm.map(m=>m.round_no))];
    const roundHtml=rounds.map(r=>`<div class="round-block"><div class="round-title">Runde ${r}</div>${gm.filter(m=>m.round_no===r).map(matchHtml).join('')}</div>`).join('');
    return `<div class="group-card"><div class="heading"><div><small>PULJE ${g.group_no}</small><h2>${gp.length} spillere</h2></div><div class="status">${tournamentIsChicago()? 'Chicago Style' : `${Number(tournament?.game)||501} • Best av ${g.best_of}`}</div></div><table class="standings"><thead><tr><th>#</th><th>Spiller</th><th>V</th><th>+/-</th><th>${tournamentIsChicago()?'Games':'Legs'}</th></tr></thead><tbody>${table.map((x,i)=>`<tr class="${i<qualify?'qualify':''}"><td>${i+1}</td><td>${esc(names[x.id]||'Spiller')}</td><td>${x.w}</td><td>${x.d>0?'+':''}${x.d}</td><td>${x.lf}</td></tr>`).join('')}</tbody></table><details class="group-matches-details" ${collapseArchivedGroups?'':'open'}><summary><span>Puljekamper</span><span class="group-match-summary-meta">${gm.length} kamper <span class="group-match-chevron" aria-hidden="true">⌄</span></span></summary><div class="group-rounds">${roundHtml}</div></details></div>`;
  }).join('');
  if(collapseArchivedGroups){
    const details=[...$('liveGroups').querySelectorAll('.group-matches-details')];
    details.forEach(detail=>detail.addEventListener('toggle',()=>{
      if(!detail.open)return;
      details.forEach(other=>{if(other!==detail)other.open=false});
    }));
  }
}

function matchHtml(m){
  const p1=esc(names[m.player1_id]||'Spiller');
  const p2=esc(names[m.player2_id]||'Spiller');
  const done=['finished','wo'].includes(m.status);
  const live=m.status==='live';
  const score=live
    ?`${Number(m._live_player1_legs??m.player1_legs??0)}–${Number(m._live_player2_legs??m.player2_legs??0)}`
    :done
      ?`${Number(m.player1_legs||0)}–${Number(m.player2_legs||0)}`
      :'VS';
  const state=live?'LIVE':m.status==='finished'?'Ferdig':m.status==='wo'?'WO':'Klar';
  const avg=v=>Number.isFinite(Number(v))&&Number(v)>0?`<span class="group-match-avg">${Number(v).toFixed(1).replace('.',',')} AVG</span>`:'';
  return `<div class="match-row ${live?'live-match':''}" data-match="${m.id}">
    <div class="match-players"><span class="group-match-player"><strong>${p1}</strong>${avg(m._player1_avg)}</span><span class="muted">vs</span><span class="group-match-player"><strong>${p2}</strong>${avg(m._player2_avg)}</span></div>
    <div class="match-meta"><div class="match-score">${score}</div><div class="match-state">${state}</div></div>
  </div>`;
}

async function startGroups(){
  if(!drawnGroups||tournament?.owner_id!==me)return;
  const dialog=await getDialog();
  const ok=dialog
    ?await dialog.confirm('Starte puljespillet med denne trekningen?\n\nEtter start er puljene låst.',{title:'Start puljespill',confirmText:'Start puljespill'})
    :confirm('Starte puljespillet med denne trekningen? Etter start er puljene låst.');
  if(!ok)return;
  const btn=$('startGroupsBtn');
  btn.disabled=true;
  btn.textContent='Starter…';
  try{
    const selection=document.getElementById('tournamentGame')?.value||(tournamentIsChicago()?'chicago':String(tournament.game||501));
    const chicago=selection==='chicago';
    const game=chicago?501:Number(selection);
    const gameVariant=chicago?'chicago':'x01';
    if(!chicago&&!validTournamentGame(game))throw new Error('Velg et gyldig puljespill.');

    const cupSelection=document.getElementById('tournamentCupGame')?.value||(tournamentCupIsChicago()?'chicago':String(tournament.cup_game||501));
    const cupChicago=cupSelection==='chicago';
    const cupGame=cupChicago?501:Number(cupSelection);
    const cupGameVariant=cupChicago?'chicago':'x01';
    if(!cupChicago&&!validTournamentGame(cupGame))throw new Error('Velg et gyldig cupspill.');

    const bestOf=chicago?3:Number($('groupBestOf').value);
    const advance=$('advanceCount').value;
    const advanceMode=advance==='all'?'all':'top';
    const advanceCount=advance==='all'?null:Number(advance);
    const {data:existing,error:existingErr}=await db.from('tournament_groups').select('id').eq('tournament_id',id).limit(1);
    if(existingErr)throw existingErr;
    if(existing?.length)throw new Error('Puljeoppsettet er allerede lagret for denne turneringen.');

    const groupRows=drawnGroups.map((_,i)=>({tournament_id:id,group_no:i+1,best_of:bestOf,advance_mode:advanceMode,advance_count:advanceCount}));
    const {data:savedGroups,error:gErr}=await db.from('tournament_groups').insert(groupRows).select('id,group_no');
    if(gErr)throw gErr;
    const byNo=Object.fromEntries(savedGroups.map(g=>[g.group_no,g]));

    const playerRows=[];
    drawnGroups.forEach((group,gi)=>group.forEach((p,pi)=>playerRows.push({tournament_id:id,group_id:byNo[gi+1].id,user_id:p.user_id,seed_no:pi+1})));
    const {error:pErr}=await db.from('tournament_group_players').insert(playerRows);
    if(pErr)throw pErr;

    const matchRows=[];
    drawnGroups.forEach((group,gi)=>{
      let matchNo=1;
      roundRobin(group).forEach((round,ri)=>round.forEach(([p1,p2])=>matchRows.push({
        tournament_id:id,stage:'group',group_id:byNo[gi+1].id,round_no:ri+1,match_no:matchNo++,player1_id:p1,player2_id:p2,best_of:bestOf,status:'pending',is_wo:false
      })));
    });
    if(matchRows.length){
      const {error:mErr}=await db.from('tournament_matches').insert(matchRows);
      if(mErr)throw mErr;
    }

    const {error:tErr}=await db.from('tournaments')
      .update({status:'groups',game,game_variant:gameVariant,cup_game:cupGame,cup_game_variant:cupGameVariant,updated_at:new Date().toISOString()})
      .eq('id',id)
      .eq('owner_id',me)
      .eq('status','groups_setup');
    if(tErr)throw tErr;
    tournament.game=game;
    tournament.game_variant=gameVariant;
    tournament.cup_game=cupGame;
    tournament.cup_game_variant=cupGameVariant;
    drawnGroups=null;
    await load();
    alert(`Puljespillet er startet. ${matchRows.length} kamper er satt opp.`);
  }catch(e){
    console.error(e);
    alert('Kunne ikke starte puljespillet: '+(e.message||e));
  }finally{
    btn.disabled=false;
    btn.textContent='Start puljespill';
  }
}

async function join(){
  const b=$('joinBtn'),old=b.textContent;
  b.disabled=true;b.textContent='Melder på…';
  try{
    const {error}=await db.from('tournament_members').insert({tournament_id:id,user_id:me,role:'participant'});
    if(error)throw error;
    await load();
  }catch(e){alert(e.message||e);}
  finally{b.disabled=false;b.textContent=old;}
}

async function leave(){
  const b=$('leaveBtn'),old=b.textContent;
  b.disabled=true;b.textContent='Melder av…';
  try{
    const {error}=await db.from('tournament_members').delete().eq('tournament_id',id).eq('user_id',me).eq('role','participant');
    if(error)throw error;
    await load();
  }catch(e){alert(e.message||e);}
  finally{b.disabled=false;b.textContent=old;}
}

async function closeRegistration(){
  const dialog=await getDialog();
  const ok=dialog
    ?await dialog.confirm('Stenge påmeldingen?\n\nSpillere kan ikke melde seg av etter dette.',{title:'Steng påmelding',tone:'warning',confirmText:'Steng påmelding'})
    :confirm('Stenge påmeldingen? Spillere kan ikke melde seg av etter dette.');
  if(!ok)return;
  const b=$('closeRegistrationBtn'),old=b.textContent;
  b.disabled=true;b.textContent='Stenger…';
  try{
    const nextStatus=tournament.tournament_type==='groups_cup'?'groups_setup':'cup_setup';
    const {error}=await db.from('tournaments')
      .update({registration_open:false,status:nextStatus,updated_at:new Date().toISOString()})
      .eq('id',id)
      .eq('owner_id',me);
    if(error)throw error;
    await load();
  }catch(e){alert(e.message||e);}
  finally{b.disabled=false;b.textContent=old;}
}

async function cancelTournament(){
  if(!tournament||['finished','cancelled'].includes(tournament.status))return;
  const dialog=await getDialog();
  const text='Er du sikker på at du vil avbryte turneringen?\n\nTurneringen avsluttes og kan ikke fortsettes. Data slettes ikke.';
  const ok=dialog
    ?await dialog.confirm(text,{title:'Avbryt turnering',tone:'danger',confirmText:'Avbryt turnering'})
    :confirm(text);
  if(!ok)return;
  const b=$('cancelTournamentBtn'),old=b.textContent;
  b.disabled=true;b.textContent='Avbryter…';
  try{
    const {error}=await db.from('tournaments')
      .update({status:'cancelled',registration_open:false,updated_at:new Date().toISOString()})
      .eq('id',id)
      .eq('owner_id',me);
    if(error)throw error;
    await load();
  }catch(e){alert(e.message||e);}
  finally{b.disabled=false;b.textContent=old;}
}

boot().catch(error=>{
  console.error('Tournament boot failed',error);
  showTournamentUnavailable('Turneringen kunne ikke lastes.');
});