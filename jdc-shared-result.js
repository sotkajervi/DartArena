(()=>{
  const providers=window.DartArenaResultProviders=window.DartArenaResultProviders||{};
  const TIER_LABELS={white:'White',purple:'Purple',yellow:'Yellow',green:'Green',blue:'Blue',red:'Red',black:'Black',gold:'Gold'};
  const tierFor=score=>score>=1250?'gold':score>=850?'black':score>=700?'red':score>=600?'blue':score>=450?'green':score>=300?'yellow':score>=150?'purple':'white';

  providers.jdc=async(m,db)=>{
    const {data,error}=await db.from('jdc_match_turns').select('player_id,hits,points').eq('match_id',m.id);
    if(error)throw error;
    const out={};
    for(const id of[m.player1_id,m.player2_id])out[id]={hits:0,misses:0,score:id===m.player1_id?Number(m.player1_score||0):Number(m.player2_score||0)};
    for(const row of data||[]){
      const s=out[row.player_id];if(!s)continue;
      for(const hit of row.hits||[]){if(hit==='M')s.misses++;else s.hits++;}
    }
    const mk=id=>{
      const s=out[id],tier=tierFor(s.score);
      return[
        {label:'OFFISIELL SCORE',value:s.score},
        {label:'TIER',value:`${TIER_LABELS[tier]} tier`},
        {label:'TREFF',value:s.hits},
        {label:'BOM',value:s.misses}
      ];
    };

    // Shared-results uses legs in its main score box. JDC uses the official point score,
    // so replace only that value after the shared overlay has mounted.
    setTimeout(()=>{
      const box=document.querySelector('#dartArenaResultOverlay .da-result-scorebox');
      if(box)box.innerHTML=`${Number(m.player1_score||0)}<span>–</span>${Number(m.player2_score||0)}`;
    },0);

    return{
      label:'JDC Challenge',
      format:'57 piler hver • Online-verifisert',
      stats:{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)},
      summary:[]
    };
  };
})();