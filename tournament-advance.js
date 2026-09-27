// Show an owner-only button when every group match is finished.
(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');if(!tournamentId||!window.supabase)return;
  const client=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  let me=null,busy=false,ch=null;
  function ensureButton(){
    let b=document.getElementById('advanceToCupBtn');if(b)return b;
    const heading=document.querySelector('#groupLobby .heading');if(!heading)return null;
    b=document.createElement('button');b.id='advanceToCupBtn';b.className='primary hidden';b.textContent='Gå videre til cup';heading.appendChild(b);b.onclick=advance;return b;
  }
  async function refresh(){
    if(busy)return;const b=ensureButton();if(!b)return;
    busy=true;try{
      const {data:t}=await client.from('tournaments').select('owner_id,status,tournament_type').eq('id',tournamentId).single();
      if(!t||t.status!=='groups'||t.owner_id!==me||t.tournament_type!=='groups_cup'){b.classList.add('hidden');return}
      const {data:m,error}=await client.from('tournament_matches').select('status').eq('tournament_id',tournamentId).eq('stage','group');if(error){b.classList.add('hidden');return}
      const allDone=!!m?.length&&m.every(x=>['finished','wo'].includes(x.status));b.classList.toggle('hidden',!allDone);
    }finally{busy=false}
  }
  async function advance(){
    const b=ensureButton();if(!b||b.classList.contains('hidden'))return;
    if(!confirm('Alle puljekampene er ferdige. Gå videre til oppsett av cup?'))return;
    b.disabled=true;b.textContent='Går videre…';
    const {error}=await client.from('tournaments').update({status:'cup_setup',updated_at:new Date().toISOString()}).eq('id',tournamentId).eq('owner_id',me).eq('status','groups');
    if(error){alert('Kunne ikke gå videre til cup: '+error.message);b.disabled=false;b.textContent='Gå videre til cup';return}
    location.reload();
  }
  async function boot(){const {data:{session}}=await client.auth.getSession();me=session?.user?.id||null;if(!me)return;await refresh();ch=client.channel(`advance-cup-${tournamentId}`).on('postgres_changes',{event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`},()=>setTimeout(refresh,100)).on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournaments',filter:`id=eq.${tournamentId}`},()=>setTimeout(refresh,100)).subscribe();setInterval(refresh,2500)}
  boot();
})();