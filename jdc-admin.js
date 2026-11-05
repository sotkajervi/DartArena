(()=>{
  if(!window.supabase||window.__dartArenaJdcAdmin)return;
  window.__dartArenaJdcAdmin=true;

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  let isAdmin=false;
  let decorating=false;
  let queued=false;
  let dialogPromise=null;

  function ensureDialog(){
    if(window.DartArenaDialog)return Promise.resolve(window.DartArenaDialog);
    if(dialogPromise)return dialogPromise;
    dialogPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='dartarena-dialog.js?v=20261002-dialog1';
      script.onload=()=>resolve(window.DartArenaDialog);
      script.onerror=()=>reject(new Error('Kunne ikke laste DartArena-dialog.'));
      document.head.appendChild(script);
    });
    return dialogPromise;
  }

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
    const dialog=await ensureDialog().catch(()=>null);
    const text=`Slette ${score} poeng for ${name}?\n\nHvis spilleren har et lavere JDC-resultat, blir det automatisk ny beste score og tier-fargen oppdateres.`;
    const ok=dialog
      ?await dialog.confirm(text,{title:'Slett JDC-resultat',tone:'danger',confirmText:'Slett resultat'})
      :confirm(text);
    if(!ok)return;

    button.disabled=true;
    button.classList.add('ui-busy');
    const {error}=await db.rpc('admin_delete_jdc_result',{p_result_id:Number(row.result_id)});
    if(error){
      button.disabled=false;
      button.classList.remove('ui-busy');
      const message=`Kunne ikke slette resultatet: ${error.message||'ukjent feil'}`;
      if(dialog)await dialog.alert(message,{title:'Kunne ikke slette',tone:'danger'});else alert(message);
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


  // Owner/Admin: complete audit list for JDC, 61 and Half-It training results.
  let resultOffset=0;
  const pageSize=40;
  function makeAdminRecordsPanel(){
    const host=document.getElementById('leaderboardRows');
    if(!host)return null;
    let panel=document.getElementById('daAdminTrainingRecords');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.id='daAdminTrainingRecords';
    panel.className='card';
    panel.style.cssText='margin-top:16px;padding:16px';
    const heading=document.createElement('h2');
    heading.textContent='Administrer treningsresultater';
    const help=document.createElement('p');
    help.className='muted';
    help.textContent='Kun Owner og Admin. JDC Challenge, 61 og Half-It. Sletting er permanent.';
    const status=document.createElement('p');status.id='daAdminRecordStatus';status.className='muted';
    const rows=document.createElement('div');rows.id='daAdminRecordRows';rows.style.cssText='display:grid;gap:6px';
    const nav=document.createElement('div');nav.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px';
    const prev=document.createElement('button');prev.className='outline';prev.type='button';prev.textContent='Forrige';
    prev.onclick=()=>{resultOffset=Math.max(0,resultOffset-pageSize);loadAdminRecords()};
    const next=document.createElement('button');next.className='outline';next.type='button';next.textContent='Neste';
    next.onclick=()=>{resultOffset+=pageSize;loadAdminRecords()};
    const page=document.createElement('span');page.id='daAdminRecordPage';page.className='muted';
    nav.append(prev,page,next);
    panel.append(heading,help,status,rows,nav);
    host.closest('section.card')?.insertAdjacentElement('afterend',panel);
    return panel;
  }
  async function loadAdminRecords(){
    const panel=makeAdminRecordsPanel();
    if(!panel)return;
    const list=panel.querySelector('#daAdminRecordRows');
    const status=panel.querySelector('#daAdminRecordStatus');
    const [prev,next]=panel.querySelectorAll('button.outline');
    status.textContent='Laster resultatene…';
    list.replaceChildren();
    const {data,error}=await db.rpc('admin_training_records_page',{p_offset:resultOffset,p_limit:pageSize});
    if(error){status.textContent='Kunne ikke laste resultatene: '+error.message;return}
    const rows=data||[];
    status.textContent=rows.length?String(rows.length)+' oppføringer på denne siden':'Ingen resultater på denne siden.';
    prev.disabled=resultOffset===0;
    next.disabled=rows.length<pageSize;
    panel.querySelector('#daAdminRecordPage').textContent='Side '+(Math.floor(resultOffset/pageSize)+1);
    const names={jdc:'JDC Challenge','61':'61',half_it:'Half-It'};
    for(const entry of rows){
      const row=document.createElement('div');
      row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:8px;border:1px solid #16434b;border-radius:8px';
      const info=document.createElement('span');
      const stamp=entry.created_at?new Date(entry.created_at).toLocaleDateString('nb-NO'):'';
      info.textContent=(entry.username||'Spiller')+' • '+(names[entry.game]||entry.game)+' '+(entry.variant==='challenge'?'':entry.variant)+' • '+entry.score+' poeng • '+stamp;
      const del=document.createElement('button');
      del.type='button';del.className='danger small-btn';del.textContent='Slett';
      del.onclick=async()=>{
        const msg='Slette dette resultatet permanent?\\n'+info.textContent;
        const dialog=await ensureDialog().catch(()=>null);
        const accepted=dialog?await dialog.confirm(msg,{title:'Slett treningsresultat',tone:'danger',confirmText:'Slett resultat'}):confirm(msg);
        if(!accepted)return;
        del.disabled=true;
        const {error:deleteError}=await db.rpc('admin_delete_training_record',{p_game:entry.game,p_result_id:Number(entry.result_id)});
        if(deleteError){
          del.disabled=false;
          if(dialog)await dialog.alert(deleteError.message,{title:'Kunne ikke slette',tone:'danger'});else alert(deleteError.message);
          return;
        }
        // JDC top lists and role badges derive their next best value from the remaining rows.
        if(entry.game==='jdc'){location.reload();return}
        await loadAdminRecords();
      };
      row.append(info,del);list.append(row);
    }
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const {data,error}=await db.rpc('is_admin');
    isAdmin=!error&&data===true;
    if(!isAdmin)return;
    ensureDialog().catch(()=>{});
    showNotice();
    await decorate();
    await loadAdminRecords();
    const host=document.getElementById('leaderboardRows');
    if(host)new MutationObserver(scheduleDecorate).observe(host,{childList:true,subtree:true});
  }

  boot().catch(error=>console.warn('JDC admin init failed',error));
})();