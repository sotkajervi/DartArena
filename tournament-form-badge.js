(()=>{
  if(!window.supabase)return;
  const badge=document.getElementById('tournamentFormStatsBadge');
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!badge||!tournamentId)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  function render(enabled){
    const on=enabled!==false;
    badge.textContent=on?'FORM STATS':'FORM STATS AV';
    badge.classList.toggle('off',!on);
    badge.title=on?'501-kamper teller i Form stats':'Denne turneringen teller ikke i Form stats';
    badge.classList.remove('hidden');
  }

  async function load(){
    const {data,error}=await db.from('tournaments').select('stats_enabled').eq('id',tournamentId).maybeSingle();
    if(error){console.warn('Form stats badge lookup failed',error);return}
    if(data)render(data.stats_enabled);
  }

  load();
  const channel=db.channel('tournament-form-stats-'+tournamentId)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournaments',filter:`id=eq.${tournamentId}`},payload=>render(payload.new?.stats_enabled))
    .subscribe();

  window.addEventListener('pagehide',()=>{try{db.removeChannel(channel)}catch{}});
})();
