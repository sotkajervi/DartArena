(()=>{
  const wait=setInterval(()=>{
    const button=document.getElementById('cancelMatchBtn');
    if(!button||!window.supabase)return;
    clearInterval(wait);
    const matchId=new URLSearchParams(location.search).get('id');
    if(!matchId)return;
    const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
    button.onclick=async()=>{
      if(!confirm('Vil du avbryte kampen?'))return;
      button.disabled=true;button.textContent='Avbryter…';
      const {data,error}=await db.rpc('cancel_match',{p_match_id:matchId});
      if(error){
        const msg=document.getElementById('matchMessage');
        if(msg)msg.textContent='Kunne ikke avbryte: '+error.message;
        button.disabled=false;button.textContent='Avbryt kamp';
        return;
      }
      try{window.opener?.postMessage({type:'dartarena-match-ended',id:matchId},location.origin)}catch{}
      if(data)button.classList.add('hidden');
      window.close();
    };
  },100);
})();
