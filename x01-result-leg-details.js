(()=>{
  if(window.__dartArenaX01ResultLegDetails)return;
  window.__dartArenaX01ResultLegDetails=true;

  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const style=document.createElement('style');
  style.textContent=`
    .da-result-legrow.da-x01-legdetail{
      grid-template-columns:minmax(54px,.45fr) minmax(120px,1.45fr) auto;
      gap:10px;
      margin-top:6px;
      padding:7px 9px;
      border:1px solid rgba(255,255,255,.085);
      border-radius:8px;
      background:rgba(255,255,255,.018);
    }
    .da-result-legrow.da-x01-legdetail:first-of-type{border-top:1px solid rgba(255,255,255,.085)}
    .da-result-legrow.da-x01-legdetail .da-result-legwinner{text-align:left}
    .da-result-legmeta{
      text-align:right;
      color:var(--muted);
      font-size:11px;
      white-space:nowrap;
    }
    @media(max-width:640px){
      .da-result-legrow.da-x01-legdetail{grid-template-columns:48px minmax(0,1fr) auto;gap:7px;padding:7px 8px}
      .da-result-legmeta{font-size:10px}
    }
  `;
  document.head.appendChild(style);

  let busy=false;

  const n=v=>Number(v||0);
  const byTime=(a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0);

  async function enhance(){
    const overlay=document.getElementById('dartArenaResultOverlay');
    if(!overlay||busy||overlay.dataset.x01LegDetails==='1')return;
    const legRows=[...overlay.querySelectorAll('.da-result-legrow')];
    if(!legRows.length)return;

    busy=true;
    try{
      const [{data:match,error:matchError},{data:throws,error:throwError}]=await Promise.all([
        db.from('matches').select('id,game_variant,match_mode').eq('id',matchId).maybeSingle(),
        db.from('match_throws')
          .select('player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,created_at')
          .eq('match_id',matchId)
      ]);
      if(matchError||throwError||!match)return;
      if(match.game_variant&&match.game_variant!=='x01')return;

      const rows=(throws||[]).sort(byTime);
      const completed=[];
      const seen=new Set();
      for(const checkout of rows.filter(r=>r.is_checkout)){
        const setNo=n(checkout.set_no)||1;
        const legNo=n(checkout.leg_no)||1;
        const key=`${setNo}:${legNo}`;
        if(seen.has(key))continue;
        seen.add(key);

        const winnerRows=rows.filter(r=>(n(r.set_no)||1)===setNo&&(n(r.leg_no)||1)===legNo&&r.player_id===checkout.player_id);
        const darts=winnerRows.reduce((sum,r)=>sum+(r.is_checkout?Math.max(1,n(r.darts_used)||3):3),0);
        completed.push({winnerId:checkout.player_id,darts,checkout:n(checkout.score)});
      }

      if(!completed.length)return;
      const visible=completed.slice(-legRows.length);
      legRows.forEach((row,index)=>{
        const detail=visible[index];
        if(!detail)return;
        const parts=[...row.children];
        const label=parts[0]?.textContent?.trim()||`Leg ${index+1}`;
        const winnerEl=parts.find(el=>el.classList.contains('da-result-legwinner'))||parts.at(-1);
        const winnerName=winnerEl?.textContent?.trim()||'Vinner';
        const winnerClass=winnerEl?.classList.contains('is-winner')?' is-winner':'';
        row.classList.add('da-x01-legdetail');
        row.innerHTML=`<span>${escapeHtml(label)}</span><span class="da-result-legwinner${winnerClass}">${escapeHtml(winnerName)}</span><span class="da-result-legmeta">${detail.darts} piler · checkout ${detail.checkout}</span>`;
      });
      overlay.dataset.x01LegDetails='1';
    }catch(error){
      console.warn('X01 leg details failed',error);
    }finally{
      busy=false;
    }
  }

  function escapeHtml(value=''){
    return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  const observer=new MutationObserver(()=>enhance());
  observer.observe(document.body,{childList:true,subtree:true});
  enhance();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
