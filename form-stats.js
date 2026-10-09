const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TIER_LABELS={white:'White',purple:'Purple',yellow:'Yellow',green:'Green',blue:'Blue',red:'Red',black:'Black',gold:'Gold'};

$('backBtn').onclick=()=>location.href='./';

function num(value,digits=2){
  const n=Number(value);
  return Number.isFinite(n)?n.toFixed(digits):'–';
}

function tierDot(row){
  if(!row)return'';
  const badge=String(row.badge||'white');
  const label=TIER_LABELS[badge]||badge;
  const score=Number(row.best_score)||0;
  return `<span class="jdc-tier-dot" data-jdc-tier="${esc(badge)}" title="JDC Challenge: ${esc(label)} • beste ${score}"></span>`;
}

function setupFormStatsScrollHint(){
  const wrap=$('formTableWrap');
  const frame=$('formTableFrame');
  const hint=$('formScrollHint');
  const text=$('formScrollHintText');
  const mobile=window.matchMedia('(max-width: 760px)');
  const update=()=>{
    const overflow=wrap.scrollWidth>wrap.clientWidth+8;
    const visible=mobile.matches&&!wrap.classList.contains('hidden')&&overflow;
    hint.hidden=!visible;
    const left=Math.max(0,wrap.scrollLeft);
    const right=Math.max(0,wrap.scrollWidth-wrap.clientWidth-wrap.scrollLeft);
    frame.classList.toggle('can-scroll-left',visible&&left>8);
    frame.classList.toggle('can-scroll-right',visible&&right>8);
    if(!visible)return;
    text.textContent=right<=8?'Sveip mot høyre for spillerne':left<=8?'Sveip mot venstre for flere stats':'Sveip sideveis for flere stats';
  };
  wrap.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update);
  if('ResizeObserver'in window){
    const observer=new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(wrap.querySelector('table'));
  }
  return update;
}
const updateFormStatsScrollHint=setupFormStatsScrollHint();

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session)return location.replace('./');

  const {data,error}=await db.rpc('get_form_stats',{p_tournament_limit:5});
  if(error)throw error;

  const rows=data||[];
  if(!rows.length){
    $('formState').textContent='Ingen ferdige turneringer med registrerte 501-kast ennå.';
    return;
  }

  const ids=rows.map(row=>row.player_id).filter(Boolean);
  const {data:jdcRows,error:jdcError}=ids.length
    ?await db.from('jdc_challenge_best').select('user_id,best_score,badge').in('user_id',ids)
    :{data:[],error:null};
  if(jdcError)console.warn('JDC tiers could not be loaded',jdcError);
  const jdcByUser=new Map((jdcRows||[]).map(row=>[row.user_id,row]));

  $('formTableBody').innerHTML=rows.map((row,index)=>{
    const tournaments=Number(row.tournaments_count||0);
    const tournamentLabel=tournaments===1?'1 turnering':`${tournaments} turneringer`;
    const fastest=Number(row.fastest_leg||0);
    return `<tr>
      <td><span class="form-rank">${index+1}</span><span class="form-player">${esc(row.username||'Spiller')}</span>${tierDot(jdcByUser.get(row.player_id))}<span class="form-sub">${tournamentLabel}</span></td>
      <td class="form-avg">${num(row.form_avg)}</td>
      <td class="form-first9">${num(row.first9_avg)}</td>
      <td>${Number(row.count_100||0)}</td>
      <td>${Number(row.count_140||0)}</td>
      <td>${Number(row.count_170||0)}</td>
      <td>${Number(row.count_180||0)}</td>
      <td>${Number(row.highest_checkout||0)||'–'}</td>
      <td>${fastest?`${fastest} piler`:'–'}</td>
      <td>${Number(row.matches_count||0)}</td>
      <td>${Number(row.legs_count||0)}</td>
      <td>${tournaments}</td>
    </tr>`;
  }).join('');

  $('formState').classList.add('hidden');
  $('formTableWrap').classList.remove('hidden');
  requestAnimationFrame(updateFormStatsScrollHint);
  $('formUpdated').textContent=`Oppdatert ${new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
}

boot().catch(error=>{
  console.error('Form stats failed',error);
  $('formState').textContent='Kunne ikke laste formstatistikken.';
});
