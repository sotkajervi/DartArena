(()=>{
 'use strict';
 const URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
 const KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
 const db=window.DartArenaSupabaseClient||
  (window.DartArenaSupabaseClient=window.supabase.createClient(URL,KEY));
 const $=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 }[ch]));
 function date(value){
  const when=new Date(value);
  return Number.isNaN(when.getTime())?'–':new Intl.DateTimeFormat('nb-NO',
   {day:'2-digit',month:'2-digit',year:'numeric'}).format(when);
 }
 let fetching=false;
 async function load(){
  if(fetching)return;
  fetching=true;
  $('refreshBtn').disabled=true;
  $('leaderboardRows').innerHTML='<div class="jdc-empty">Laster topplisten…</div>';
  try{
   const {data,error}=await db.rpc('get_pentathlon_online_top10');
   if(error)throw error;
   const rows=data||[],top=rows.filter(r=>Number(r.place)<=10);
   const mine=rows.find(r=>r.is_mine);
   $('myBest').textContent=mine
    ?'Din beste: '+Number(mine.best_score)+' P · Plass '+Number(mine.place)
    :'Din beste: ingen fullført Pentathlon-kamp ennå.';
   $('leaderboardRows').innerHTML=top.length?top.map(row=>
    '<div class="jdc-lb-row'+(row.is_mine?' is-mine':'')+'">'+
    '<b>'+Number(row.place)+'</b>'+
    '<strong class="pt-name"><span class="da-role-player" data-user-id="'+esc(row.user_id)+'">'+esc(row.username||'Spiller')+'</span></strong>'+
    '<span class="pt-score">'+Number(row.best_score)+' P</span>'+
    '<span class="pt-date">'+esc(date(row.achieved_at))+'</span>'+
    '</div>'
   ).join(''):'<div class="jdc-empty">Ingen fullførte Pentathlon-kamper ennå.</div>';
   window.DartArenaRoleVisuals?.scan?.($('leaderboardRows'));
  }catch(error){
   console.error('[Pentathlon Top 10]',error);
   $('leaderboardRows').innerHTML='<div class="jdc-empty">Kunne ikke laste topplisten. Prøv Oppdater.</div>';
   $('myBest').textContent='Din beste: ikke tilgjengelig.';
  }finally{
   fetching=false;
   $('refreshBtn').disabled=false;
  }
 }
 $('backBtn').onclick=()=>location.assign('./');
 $('refreshBtn').onclick=load;
 db.auth.getSession().then(({data:{session}})=>{
  if(!session){location.replace('./');return}
  load();
 }).catch(error=>{console.error(error);location.replace('./')});
})();