(()=>{
  if(!window.supabase||window.__dartArenaJdcAdmin)return;
  window.__dartArenaJdcAdmin=true;

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  let isAdmin=false;
  let decorating=false;
  let queued=false;

  const tierLabel=badge=>({white:'White',purple:'Purple',yellow:'Yellow',green:'Green',blue:'Blue',red:'Red',black:'Black',gold:'Gold'})[badge]||badge||'White';

  async function fetchTop(){
    const {data,error}=await db
      .from('jdc_challenge_best')
      .select('result_id,user_id,username,best_score,badge,achieved_at')
      .order('best_score',{ascending:false})
      .order('achieved_at',{ascending:true})
      .limit(10);
    if(error)throw error;
    return data||[];
  }

  async function removeResult(row,button){
    const name=row.username||'spilleren';
    const score=Number(row.best_score)||0;
    if(!confirm(`Slette ${score} poeng for ${name}?\n\nHvis spilleren har et lavere JDC-resultat, blir det automatisk ny beste score og tier-fargen oppdateres.`))return;

    button.disabled=true;
    button.classList.add('ui-busy');
    const {error}=await db.rpc('admin_delete_jdc_result',{p_result_id:Number(row.result_id)});
    if(error){
      button.disabled=false;
      button.classList.remove('ui-busy');
      alert(`Kunne ikke slette resultatet: ${error.message||'ukjent feil'}`);
      return;
    }

    const {data:replacement}=await db
      .from('jdc_challenge_best')
      .select('best_score,badge')
      .eq('user_id',row.user_id)
      .maybeSingle();

    if(replacement){
      sessionStorage.setItem('dartarena-jdc-admin-notice',`${name}: ny beste ${Number(replacement.best_score)||0} • ${tierLabel(replacement.badge)} tier`);
    }else{
      sessionStorage.setItem('dartarena-jdc-admin-notice',`${name}: JDC-merket er fjernet fordi spilleren ikke har flere registrerte resultater.`);
    }
    location.reload();
  }

  async function decorate(){
    if(!isAdmin||decorating)return;
    const host=document.getElementById('leaderboardRows');
    if(!host||!host.querySelector('.jdc-lb-row'))return;
    decorating=true;
    try{
      const rows=await fetchTop();
      const domRows=[...host.querySelectorAll('.jdc-lb-row')];
      domRows.forEach((el,index)=>{
        const row=rows[index];
        if(!row?.result_id)return;
        el.dataset.resultId=String(row.result_id);
        const tier=el.querySelector('.tier');
        if(!tier)return;
        tier.classList.add('jdc-tier-admin');
        if(tier.querySelector('.jdc-admin-delete'))return;
        const button=document.createElement('button');
        button.type='button';
        button.className='danger small-btn jdc-admin-delete';
        button.textContent='Slett';
        button.title=`Slett ${row.best_score} poeng for ${row.username||'spilleren'}`;
        button.addEventListener('click',()=>removeResult(row,button));
        tier.appendChild(button);
      });
    }catch(error){
      console.warn('JDC admin controls failed',error);
    }finally{
      decorating=false;
    }
  }

  function showNotice(){
    const notice=sessionStorage.getItem('dartarena-jdc-admin-notice');
    if(!notice)return;
    sessionStorage.removeItem('dartarena-jdc-admin-notice');
    const best=document.getElementById('myBest');
    if(!best)return;
    const p=document.createElement('p');
    p.className='jdc-admin-note';
    p.textContent=notice;
    best.insertAdjacentElement('afterend',p);
  }

  function scheduleDecorate(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      decorate();
    });
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const {data,error}=await db.rpc('is_admin');
    isAdmin=!error&&data===true;
    if(!isAdmin)return;
    showNotice();
    await decorate();
    const host=document.getElementById('leaderboardRows');
    if(host)new MutationObserver(scheduleDecorate).observe(host,{childList:true,subtree:true});
  }

  boot().catch(error=>console.warn('JDC admin init failed',error));
})();
