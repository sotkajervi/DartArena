/* Personal 501 density, separate from score statistics. Only the signed-in
   player's own profile. No additional camera access. */
(()=>{
'use strict';
const S=window.DartArenaHeatmapStorage,Chart=window.DartArenaHeatmapChart,host=document.getElementById('personalHeatmap');
if(!S||!Chart||!host||!window.supabase)return;
const uid=new URLSearchParams(location.search).get('id'),db=window.DartArenaSupabaseClient;
if(!uid||!db)return;
const select=host.querySelector('select'),canvas=host.querySelector('canvas'),note=host.querySelector('p');
let request=0;
async function load(){
 const n=++request;note.textContent='Laster lagrede treff…';
 try{
  const rows=[];let offset=0;
  const cutoff=select.value==='all'?null:new Date(Date.now()-Number(select.value)*86400000).toISOString();
  while(true){
   let q=db.from('match_heatmaps').select('match_id,points,matches!inner(game,status,finished_at,deleted_at,is_warmup,game_variant,game_config)').eq('player_id',uid).eq('matches.game',501).eq('matches.status','finished').is('matches.deleted_at',null).or('is_warmup.is.null,is_warmup.eq.false',{referencedTable:'matches'}).order('match_id').range(offset,offset+49);
   if(cutoff)q=q.gte('matches.finished_at',cutoff);
   const {data,error}=await q;if(error)throw error;if(n!==request)return;
   for(const r of data||[]){const m=r.matches;if(m&&(m.game_variant||'x01')==='x01'&&String(m.game_config?.chicago??'false').toLowerCase()!=='true')rows.push(r)}
   if((data||[]).length<50)break;offset+=50;
  }
  const aggregate=S.aggregate(rows);Chart.draw(canvas,aggregate.points,true);
  note.textContent=aggregate.count?aggregate.count+' registrerte kameraestimater fra '+rows.length+' kamper.':'Ingen lagrede treff i perioden.';
 }catch(e){if(n===request){Chart.draw(canvas,[],true);note.textContent='Kunne ikke laste heatmap-data.'}console.warn('Personal heatmap unavailable',e?.message||e)}
}
db.auth.getSession().then(({data})=>{if(data?.session?.user?.id!==uid)return;host.hidden=false;select.onchange=load;load()}).catch(()=>{});
})();
