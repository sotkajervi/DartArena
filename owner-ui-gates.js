(()=>{
  if(!window.supabase||window.__dartArenaOwnerUiGates)return;
  window.__dartArenaOwnerUiGates=true;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  function ensureStyles(){
    if(document.getElementById('dartarena-owner-gates-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-owner-gates-style';
    style.textContent=`
      html.da-admin-not-owner .admin-delete-tournament,
      html.da-admin-not-owner .jdc-admin-delete,
      html.da-admin-not-owner #historyTrashBtn,
      html.da-admin-not-owner [data-delete-id],
      html.da-admin-not-owner [data-restore-id]{display:none!important}
      html.da-admin-no-result-override .edit-result-btn{display:none!important}
      .admin-badge.owner-badge{color:var(--cyan)!important;border-color:rgba(35,226,209,.55)!important;background:rgba(35,226,209,.12)!important}
    `;
    document.head.appendChild(style);
  }

  function resetGates(){
    document.documentElement.classList.remove('da-owner','da-admin-not-owner','da-admin-no-result-override');
  }

  async function boot(){
    ensureStyles();
    resetGates();
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;

    const [{data:isAdmin},{data:isOwner}]=await Promise.all([
      db.rpc('is_admin'),
      db.rpc('is_owner')
    ]);

    document.documentElement.classList.toggle('da-owner',isOwner===true);
    document.documentElement.classList.toggle('da-admin-not-owner',isAdmin===true&&isOwner!==true);

    if(isAdmin===true&&isOwner!==true){
      const params=new URLSearchParams(location.search);
      const tournamentId=params.get('id');
      if(tournamentId&&location.pathname.toLowerCase().includes('tournament')){
        const {data:t}=await db.from('tournaments').select('owner_id').eq('id',tournamentId).maybeSingle();
        document.documentElement.classList.toggle('da-admin-no-result-override',!!t&&t.owner_id!==session.user.id);
      }else{
        document.documentElement.classList.add('da-admin-no-result-override');
      }
    }
  }

  boot().catch(error=>console.warn('Owner UI gates failed',error));
  window.addEventListener('dartarena:lobby-entered',()=>boot().catch(error=>console.warn('Owner UI gates refresh failed',error)));
  window.addEventListener('dartarena:lobby-left',resetGates);
})();
