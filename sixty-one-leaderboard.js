(()=>{
const $=id=>document.getElementById(id);if(!$('leaderboardRows'))return;
const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);let minutes=10;
const fmt=s=>{if(s===null||s===undefined)return'—';const m=Math.floor(Number(s)/60),sec=Number(s)%60;return`${m}:${String(sec).padStart(2,'0')}`};
async function load(){const host=$('leaderboardRows');host.innerHTML='<div class="sixty-one-lb-empty">Laster…</div>';const{data:{session}}=await db.auth.getSession();if(!session){host.innerHTML='<div class="sixty-one-lb-empty">Logg inn for å se topplisten.</div>';return}
 const{data,error}=await db.from('sixty_one_leaderboard').select('username,high_checkout,seconds_to_high').eq('duration_seconds',minutes*60).order('high_checkout',{ascending:false}).order('seconds_to_high',{ascending:true,nullsFirst:false}).limit(10);
 if(error){host.innerHTML='<div class="sixty-one-lb-empty">Kunne ikke laste topplisten.</div>';return}
 if(!data?.length){host.innerHTML='<div class="sixty-one-lb-empty">Ingen registrerte resultater ennå.</div>';return}
 host.innerHTML=data.map((r,i)=>`<div class="sixty-one-lb-row"><b>${i+1}</b><strong>${String(r.username||'Spiller').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong><span>UT <em>${Number(r.high_checkout)||0}</em></span><small>${r.seconds_to_high==null?'':`nådd ${fmt(r.seconds_to_high)}`}</small></div>`).join('')}
document.querySelectorAll('[data-lb-minutes]').forEach(btn=>btn.addEventListener('click',()=>{minutes=Number(btn.dataset.lbMinutes);document.querySelectorAll('[data-lb-minutes]').forEach(x=>x.classList.toggle('active',x===btn));load()}));load();
})();