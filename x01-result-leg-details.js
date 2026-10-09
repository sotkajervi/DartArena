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
      gap:10px;margin-top:6px;padding:7px 9px;
      border:1px solid rgba(255,255,255,.085);border-radius:8px;background:rgba(255,255,255,.018)
    }
    .da-result-legrow.da-x01-legdetail:first-of-type{border-top:1px solid rgba(255,255,255,.085)}
    .da-result-legrow.da-x01-legdetail .da-result-legwinner{text-align:left}
    .da-result-legmeta{text-align:right;color:var(--muted);font-size:11px;white-space:nowrap}
    .da-result-setblock+.da-result-setblock{margin-top:10px}
    .da-result-sethead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 8px;margin-top:7px;border:1px solid rgba(35,226,209,.18);border-radius:8px;background:rgba(35,226,209,.05)}
    .da-result-sethead strong{color:#00eaf4;font-size:10px;letter-spacing:.11em}.da-result-sethead span{color:var(--muted);font-size:10px;font-weight:800}.da-result-sethead b{color:var(--text)}
    .da-result-setlegrow{display:grid;grid-template-columns:52px 48px minmax(100px,1fr) auto;gap:8px;align-items:center;margin-top:5px;padding:6px 8px;border:1px solid rgba(255,255,255,.075);border-radius:8px;background:rgba(255,255,255,.015);font-size:11px}
    .da-result-setlegrow .set-leg-score{text-align:center;font-weight:950;font-size:12px}.da-result-setlegrow .da-result-legwinner{text-align:left}
    @media(max-width:640px){
      .da-result-legrow.da-x01-legdetail{grid-template-columns:48px minmax(0,1fr) auto;gap:7px;padding:7px 8px}.da-result-legmeta{font-size:10px}
      .da-result-setlegrow{grid-template-columns:42px 38px minmax(0,1fr) auto;gap:5px;padding:6px}.da-result-setlegrow .da-result-legwinner{font-size:10px}.da-result-setlegrow .da-result-legmeta{font-size:9px}
    }
  `;
  document.head.appendChild(style);

  let busy=false;
  const n=v=>Number(v||0);
  const byTime=(a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0);
  const escapeHtml=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function completedLegs(rows){
    const completed=[],seen=new Set();
    for(const checkout of rows.filter(r=>r.is_checkout)){
      const setNo=n(checkout.set_no)||1,legNo=n(checkout.leg_no)||1,key=`${setNo}:${legNo}`;
      if(seen.has(key))continue;
      seen.add(key);
      const winnerRows=rows.filter(r=>(n(r.set_no)||1)===setNo&&(n(r.leg_no)||1)===legNo&&r.player_id===checkout.player_id);
      const darts=winnerRows.reduce((sum,r)=>sum+(r.is_checkout?Math.max(1,n(r.darts_used)||3):3),0);
      completed.push({setNo,legNo,winnerId:checkout.player_id,darts,checkout:n(checkout.score),createdAt:checkout.created_at||''});
    }
    return completed.sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
  }

  async function renderSets(section,match,completed){
    const ids=[match.player1_id,match.player2_id].filter(Boolean);
    const {data:profiles}=await db.from('profiles').select('id,username').in('id',ids);
    const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
    const leftId=match.winner_id===match.player2_id?match.player2_id:match.player1_id;
    const rightId=leftId===match.player1_id?match.player2_id:match.player1_id;
    const groups=new Map();
    for(const leg of completed){if(!groups.has(leg.setNo))groups.set(leg.setNo,[]);groups.get(leg.setNo).push(leg)}
    const html=[...groups.entries()].map(([setNo,legs])=>{
      let left=0,right=0;
      const rows=legs.map((leg,index)=>{
        if(leg.winnerId===leftId)left++;else if(leg.winnerId===rightId)right++;
        const winner=names[leg.winnerId]||'Vinner';
        return `<div class="da-result-setlegrow"><span>Leg ${n(leg.legNo)||index+1}</span><span class="set-leg-score">${left}–${right}</span><span class="da-result-legwinner">${escapeHtml(winner)}</span><span class="da-result-legmeta">${leg.darts} piler · checkout ${leg.checkout}</span></div>`;
      }).join('');
      const setWinnerId=left===right?null:left>right?leftId:rightId;
      const setWinner=setWinnerId?names[setWinnerId]||'Vinner':'Uavgjort';
      return `<div class="da-result-setblock"><div class="da-result-sethead"><strong>SETT ${setNo}</strong><span><b>${escapeHtml(setWinner)}</b> · ${left}–${right}</span></div>${rows}</div>`;
    }).join('');
    section.innerHTML=`<div class="da-result-legs-title">SETT FOR SETT · LEGS</div>${html}`;
  }

  async function enhance(){
    const overlay=document.getElementById('dartArenaResultOverlay');
    if(!overlay||busy||overlay.dataset.x01LegDetails==='1')return;
    const section=overlay.querySelector('.da-result-legs');
    if(!section)return;

    busy=true;
    try{
      const [{data:match,error:matchError},{data:throws,error:throwError}]=await Promise.all([
        db.from('matches').select('id,game_variant,game_config,match_mode,player1_id,player2_id,winner_id').eq('id',matchId).maybeSingle(),
        db.from('match_throws').select('player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,created_at').eq('match_id',matchId)
      ]);
      if(matchError||throwError||!match)return;
      if(String(match.game_config?.chicago??'false').toLowerCase()==='true')return;
      if(match.game_variant&&match.game_variant!=='x01')return;
      const rows=(throws||[]).sort(byTime),completed=completedLegs(rows);
      if(!completed.length)return;

      if(match.match_mode==='sets'){
        await renderSets(section,match,completed);
        overlay.dataset.x01LegDetails='1';
        return;
      }

      const legRows=[...section.querySelectorAll('.da-result-legrow')];
      if(!legRows.length)return;
      const visible=completed.slice(-legRows.length);
      legRows.forEach((row,index)=>{
        const detail=visible[index];if(!detail)return;
        const parts=[...row.children];
        const label=parts[0]?.textContent?.trim()||`Leg ${index+1}`;
        const winnerEl=parts.find(el=>el.classList.contains('da-result-legwinner'))||parts.at(-1);
        const winnerName=winnerEl?.textContent?.trim()||'Vinner';
        const winnerClass=winnerEl?.classList.contains('is-winner')?' is-winner':'';
        row.classList.add('da-x01-legdetail');
        row.innerHTML=`<span>${escapeHtml(label)}</span><span class="da-result-legwinner${winnerClass}">${escapeHtml(winnerName)}</span><span class="da-result-legmeta">${detail.darts} piler · checkout ${detail.checkout}</span>`;
      });
      overlay.dataset.x01LegDetails='1';
    }catch(error){console.warn('X01 leg details failed',error)}
    finally{busy=false}
  }

  const observer=new MutationObserver(()=>enhance());
  observer.observe(document.body,{childList:true,subtree:true});
  enhance();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();