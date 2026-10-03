(()=>{
  const $=id=>document.getElementById(id);
  let db,me,profile,channel,viewMonth,selectedDate,selectedTime='19:00',loading=false;
  let authBound=false,bound=false,bootRetry=null,startedUser=null;

  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function fmt(d){try{return new Intl.DateTimeFormat('nb-NO',{dateStyle:'short',timeStyle:'short'}).format(new Date(d))}catch{return d}}
  function pad(n){return String(n).padStart(2,'0')}
  function localValue(d,time){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${time}`}
  function pretty(d,time){if(!d)return'Velg dato og klokkeslett';const day=new Intl.DateTimeFormat('nb-NO',{weekday:'short',day:'2-digit',month:'short'}).format(d).replace('.','').toUpperCase();return `${day} · ${time}`}

  async function startForSession(session){
    const userId=session?.user?.id;
    if(!userId)return;
    if(startedUser===userId&&profile){await load();return}
    if(channel){try{await db.removeChannel(channel)}catch{}channel=null}
    loading=false;
    me=userId;
    const {data:p,error}=await db.from('profiles').select('id,username').eq('id',me).single();
    if(error||!p){console.error('Tournament profile load failed',error);return}
    profile=p;
    if(!bound){bind();bound=true}
    startedUser=me;
    await load();
    channel=db.channel(`tournament-lobby-${me}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'tournaments'},()=>setTimeout(load,80))
      .on('postgres_changes',{event:'*',schema:'public',table:'tournament_members'},()=>setTimeout(load,80))
      .on('postgres_changes',{event:'*',schema:'public',table:'tournament_matches'},()=>setTimeout(load,80))
      .subscribe();
  }

  function resetSession(){
    startedUser=null;me=null;profile=null;loading=false;
    if(channel){const old=channel;channel=null;try{db?.removeChannel(old)}catch{}}
  }

  async function boot(){
    if(!window.supabase||!$('tournamentList'))return;
    ensureFormStatsUi();
    if(!db)db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
    if(!authBound){
      authBound=true;
      db.auth.onAuthStateChange((event,s)=>{
        if(event==='SIGNED_OUT'||!s){resetSession();return}
        setTimeout(()=>startForSession(s).catch(err=>console.error('Tournament auth refresh failed',err)),0);
      });
    }
    const {data:{session}}=await db.auth.getSession();
    if(!session){
      clearTimeout(bootRetry);
      bootRetry=setTimeout(boot,300);
      return;
    }
    clearTimeout(bootRetry);bootRetry=null;
    await startForSession(session);
  }

  function ensureFormStatsUi(){
    if(!document.querySelector('link[data-tournament-form-stats]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href='tournament-form-stats.css?v=20260930-toggle2';link.dataset.tournamentFormStats='1';
      document.head.appendChild(link);
    }
    if($('tournamentFormStats'))return;
    const submit=document.querySelector('#createTournamentForm > button[type="submit"]');
    if(!submit)return;
    const option=document.createElement('label');
    option.className='form-stats-option';
    option.htmlFor='tournamentFormStats';
    option.innerHTML='<span class="form-stats-copy"><strong>Formstatistikk</strong><small>La 501-kamper fra turneringen telle i spillernes formstatistikk.</small></span><span class="form-stats-control"><span id="tournamentFormStatsState" class="form-stats-state">PÅ</span><span class="form-stats-switch"><input id="tournamentFormStats" type="checkbox" checked><span class="form-stats-slider"></span></span></span>';
    submit.insertAdjacentElement('beforebegin',option);
    $('tournamentFormStats').addEventListener('change',syncFormStatsToggle);
    syncFormStatsToggle();
  }
  function syncFormStatsToggle(){
    const on=$('tournamentFormStats')?.checked!==false;
    if($('tournamentFormStatsState'))$('tournamentFormStatsState').textContent=on?'PÅ':'AV';
    document.querySelector('.form-stats-option')?.classList.toggle('is-off',!on);
  }
  function resetFormStatsToggle(){
    if(!$('tournamentFormStats'))return;
    $('tournamentFormStats').checked=true;
    syncFormStatsToggle();
  }

  function defaultDate(){const d=new Date(Date.now()+3600000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);selectedDate=new Date(d.getFullYear(),d.getMonth(),d.getDate());selectedTime=`${pad(d.getHours())}:${pad(d.getMinutes())}`;viewMonth=new Date(d.getFullYear(),d.getMonth(),1);syncDate()}
  function bind(){$('createTournamentBtn').onclick=()=>{resetFormStatsToggle();$('tournamentModal').classList.remove('hidden');defaultDate()};$('closeTournamentModal').onclick=()=>$('tournamentModal').classList.add('hidden');$('tournamentModalBackdrop').onclick=()=>$('tournamentModal').classList.add('hidden');$('createTournamentForm').onsubmit=create;$('openDatePicker').onclick=openPicker;$('datePickerBackdrop').onclick=closePicker;$('cancelDatePicker').onclick=closePicker;$('prevMonth').onclick=()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);renderCalendar()};$('nextMonth').onclick=()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);renderCalendar()};$('customTime').oninput=e=>{if(e.target.value){selectedTime=e.target.value;renderTimes();updateSummary()}};$('confirmDatePicker').onclick=()=>{syncDate();closePicker()}}
  function openPicker(){if(!selectedDate)defaultDate();viewMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);renderCalendar();renderTimes();updateSummary();$('datePickerModal').classList.remove('hidden')}
  function closePicker(){$('datePickerModal').classList.add('hidden')}
  function renderCalendar(){const y=viewMonth.getFullYear(),m=viewMonth.getMonth();$('calendarMonth').textContent=new Intl.DateTimeFormat('nb-NO',{month:'long',year:'numeric'}).format(viewMonth);const first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),today=new Date();let html='';for(let i=0;i<first;i++)html+='<span class="calendar-empty"></span>';for(let d=1;d<=days;d++){const dt=new Date(y,m,d),past=new Date(y,m,d+1)<=new Date(today.getFullYear(),today.getMonth(),today.getDate()),sel=selectedDate&&dt.toDateString()===selectedDate.toDateString(),isToday=dt.toDateString()===today.toDateString();html+=`<button type="button" class="calendar-day${sel?' selected':''}${isToday?' today':''}" data-day="${d}" ${past?'disabled':''}>${d}</button>`}$('calendarDays').innerHTML=html;document.querySelectorAll('.calendar-day:not(:disabled)').forEach(b=>b.onclick=()=>{selectedDate=new Date(y,m,Number(b.dataset.day));renderCalendar();updateSummary()})}
  function renderTimes(){const times=['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];$('quickTimes').innerHTML=times.map(t=>`<button type="button" class="time-chip${selectedTime===t?' selected':''}" data-time="${t}">${t}</button>`).join('');document.querySelectorAll('.time-chip').forEach(b=>b.onclick=()=>{selectedTime=b.dataset.time;$('customTime').value='';renderTimes();updateSummary()})}
  function updateSummary(){$('datePickerSummary').textContent=selectedDate?pretty(selectedDate,selectedTime):'Velg dato og tid'}
  function syncDate(){if(!selectedDate)return;$('tournamentStart').value=localValue(selectedDate,selectedTime);$('dateTimeText').textContent=pretty(selectedDate,selectedTime)}

  async function create(e){e.preventDefault();const name=$('tournamentName').value.trim(),type=$('tournamentType').value,start=$('tournamentStart').value,msg=$('tournamentCreateMessage'),statsEnabled=$('tournamentFormStats')?.checked!==false;if(!start){msg.textContent='Velg starttidspunkt.';msg.className='message error';return}msg.textContent='Oppretter…';const {data,error}=await db.from('tournaments').insert({name,owner_id:me,tournament_type:type,starts_at:new Date(start).toISOString(),stats_enabled:statsEnabled}).select('*').single();if(error){msg.textContent=error.message;msg.className='message error';return}msg.textContent='';$('tournamentModal').classList.add('hidden');await load();location.href=`tournament.html?id=${encodeURIComponent(data.id)}`}

  function tournamentRow(x,list,{archive=false,winnerName=''}={}){
    const joined=list.some(m=>m.user_id===me),n=list.filter(m=>m.role==='participant').length,statsOn=x.stats_enabled!==false;
    const meta=archive
      ?`${x.tournament_type==='groups_cup'?'Puljer + cup':'Ren cup'} • Ferdig ${fmt(x.finished_at||x.updated_at||x.starts_at)} • ${n} deltakere • Vinner: ${esc(winnerName||'–')}`
      :`${x.tournament_type==='groups_cup'?'Puljer + cup':'Ren cup'} • ${fmt(x.starts_at)} • ${n} påmeldt`;
    const statsBadge=`<span class="form-stats-badge${statsOn?'':' off'}" title="${statsOn?'Teller i Form stats':'Teller ikke i Form stats'}">${statsOn?'FORM STATS':'FORM STATS AV'}</span>`;
    return `<article class="tournament-row"><div><div class="tournament-title-line"><div class="player-name">${esc(x.name)}</div>${statsBadge}</div><div class="status">${meta}</div></div><div class="challenge-actions">${archive?`<button class="small-btn" data-history-open="${x.id}">Se turnering</button><button class="small-btn" data-history-stats="${x.id}">Sluttstatistikk</button>`:`<button class="small-btn" data-open="${x.id}">Åpne</button>${x.registration_open?`<button class="small-btn ${joined?'decline':'accept'}" data-${joined?'leave':'join'}="${x.id}">${joined?'Avmeld':'Meld på'}</button>`:''}`}</div></article>`;
  }

  async function archiveWinners(past){
    if(!past.length)return {};
    const ids=past.map(x=>x.id);
    const {data:cupMatches,error}=await db.from('tournament_matches')
      .select('tournament_id,round_no,winner_id,status')
      .in('tournament_id',ids)
      .eq('stage','cup')
      .in('status',['finished','wo']);
    if(error)throw error;

    const finals={};
    for(const m of cupMatches||[]){
      if(!m.winner_id)continue;
      const current=finals[m.tournament_id];
      if(!current||Number(m.round_no||0)>Number(current.round_no||0))finals[m.tournament_id]=m;
    }
    const winnerIds=[...new Set(Object.values(finals).map(x=>x.winner_id).filter(Boolean))];
    if(!winnerIds.length)return {};
    const {data:profiles,error:pErr}=await db.from('profiles').select('id,username').in('id',winnerIds);
    if(pErr)throw pErr;
    const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
    return Object.fromEntries(Object.entries(finals).map(([tid,m])=>[tid,names[m.winner_id]||'Spiller']));
  }

  async function load(){
    if(loading||!db||!me)return;loading=true;
    try{
      const {data:t,error}=await db.from('tournaments').select('*').neq('status','cancelled').order('starts_at',{ascending:true});
      if(error)throw error;
      const rows=t||[],ids=rows.map(x=>x.id);let members=[];
      if(ids.length){const r=await db.from('tournament_members').select('tournament_id,user_id,role').in('tournament_id',ids);if(r.error)throw r.error;members=r.data||[]}
      const counts={};members.forEach(m=>(counts[m.tournament_id]??=[]).push(m));
      const active=rows.filter(x=>x.status!=='finished');
      const past=rows.filter(x=>x.status==='finished').sort((a,b)=>new Date(b.finished_at||b.updated_at||b.starts_at)-new Date(a.finished_at||a.updated_at||a.starts_at));
      const winners=await archiveWinners(past);

      $('tournamentList').innerHTML=active.length?active.map(x=>tournamentRow(x,counts[x.id]||[])).join(''):'<p class="muted">Ingen aktive turneringer akkurat nå.</p>';
      const pastBox=$('pastTournamentList');
      if(pastBox)pastBox.innerHTML=past.length?past.slice(0,30).map(x=>tournamentRow(x,counts[x.id]||[],{archive:true,winnerName:winners[x.id]||''})).join(''):'<p class="muted">Ingen ferdige turneringer ennå.</p>';

      document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>location.href=`tournament.html?id=${encodeURIComponent(b.dataset.open)}`);
      document.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>join(b.dataset.join));
      document.querySelectorAll('[data-leave]').forEach(b=>b.onclick=()=>leave(b.dataset.leave));
      document.querySelectorAll('[data-history-open]').forEach(b=>b.onclick=()=>location.href=`tournament.html?id=${encodeURIComponent(b.dataset.historyOpen)}`);
      document.querySelectorAll('[data-history-stats]').forEach(b=>b.onclick=()=>location.href=`tournament-results.html?id=${encodeURIComponent(b.dataset.historyStats)}`);
    }catch(err){
      console.error('Tournament lobby failed',err);
      $('tournamentList').innerHTML='<p class="muted">Kunne ikke laste turneringer.</p>';
      if($('pastTournamentList'))$('pastTournamentList').innerHTML='<p class="muted">Kunne ikke laste tidligere turneringer.</p>';
    }finally{loading=false}
  }

  async function join(id){const {error}=await db.from('tournament_members').insert({tournament_id:id,user_id:me,role:'participant'});if(error)alert(error.message);else load()}
  async function leave(id){const {error}=await db.from('tournament_members').delete().eq('tournament_id',id).eq('user_id',me);if(error)alert(error.message);else load()}

  const wait=setInterval(()=>{if(window.supabase&&$('tournamentList')){clearInterval(wait);boot()}},100);
})();
