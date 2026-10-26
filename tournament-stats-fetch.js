/* Fetch complete tournament visit history.
   Supabase/PostgREST limits unpaginated results (usually 1000 rows).
   An explicit, stable ID ordering keeps page boundaries deterministic. */
(function(root){
  'use strict';
  const PAGE_SIZE=500;
  async function fetchAllVisits(db,table,matchIds,columns='*'){
    if(!Array.isArray(matchIds)||!matchIds.length)return[];
    if(!['match_throws','cricket_visits'].includes(table))throw Error('Unsupported tournament visit table');
    const rows=[];
    for(let from=0;;from+=PAGE_SIZE){
      const{data,error}=await db.from(table).select(columns)
        .in('match_id',matchIds)
        .order('id',{ascending:true})
        .range(from,from+PAGE_SIZE-1);
      if(error)throw error;
      const page=data||[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  }
  const api=Object.freeze({fetchAllVisits,PAGE_SIZE});
  root.DartArenaTournamentStatsFetch=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
