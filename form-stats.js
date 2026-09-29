const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('backBtn').onclick=()=>location.href='./';

function num(value,digits=2){
  const n=Number(value);
  return Number.isFinite(n)?n.toFixed(digits):'–';
}

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

  $('formTableBody').innerHTML=rows.map((row,index)=>{
    const tournaments=Number(row.tournaments_count||0);
    const tournamentLabel=tournaments===1?'1 turnering':`${tournaments} turneringer`;
    const fastest=Number(row.fastest_leg||0);
    return `<tr>
      <td><span class="form-rank">${index+1}</span><span class="form-player">${esc(row.username||'Spiller')}</span><span class="form-sub">${tournamentLabel}</span></td>
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
  $('formUpdated').textContent=`Oppdatert ${new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
}

boot().catch(error=>{
  console.error('Form stats failed',error);
  $('formState').textContent='Kunne ikke laste formstatistikken.';
});
