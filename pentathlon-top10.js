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
 async function deleteScore(row,button){
  if(!canManage||fetching)return;
  const dialog=window.DartArenaDialog;
  if(!dialog?.confirm){console.error('DartArena dialog not loaded');return}
  const ok=await dialog.confirm(
   'Fjerne '+Number(row.best_score)+' poeng for '+(row.username||'spilleren')+
   ' fra Pentathlon Top 10?\\n\\nDette fjerner bare dette topplisteresultatet, ikke selve kampen. Har spilleren et annet gyldig resultat, rykker det opp.',
   {title:'Slett Pentathlon-resultat',kicker:'DARTARENA · TOPP 10',
    cancelText:'Tilbake',confirmText:'Slett resultat',tone:'danger'}
  );
  if(!ok)return;
  button.disabled=true;
  const {error}=await db.rpc('admin_delete_pentathlon_top10_result',
   {p_user_id:row.user_id,p_expected_score:Number(row.best_score)});
  if(error){
   button.disabled=false;
   await dialog.alert('Kunne ikke slette resultatet: '+(error.message||'Ukjent feil'),
    {title:'Sletting feilet',tone:'danger'});
   return;
  }
  await load();
 }
 function date(value){
  const when=new Date(value);
  return Number.isNaN(when.getTime())?'–':new Intl.DateTimeFormat('nb-NO',
   {day:'2-digit',month:'2-digit',year:'numeric'}).format(when);
 }
 let fetching=false;
 let canManage=false;
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
    (canManage?'<button type="button" class="small-btn danger pt-delete-score" data-user-id="'+esc(row.user_id)+'" aria-label="Slett Top 10-resultat for '+esc(row.username||'spiller')+'">Slett</button>':'')+
    '</div>'
   ).join(''):'<div class="jdc-empty">Ingen fullførte Pentathlon-kamper ennå.</div>';
   if(canManage)for(const button of $('leaderboardRows').querySelectorAll('.pt-delete-score')){
    const row=top.find(x=>x.user_id===button.dataset.userId);
    if(row)button.onclick=()=>deleteScore(row,button);
   }
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
 db.auth.getSession().then(async({data:{session}})=>{
  if(!session){location.replace('./');return}
  const {data,error}=await db.rpc('is_admin');
  if(error)console.warn('Could not check Top 10 permissions',error);
  canManage=data===true;
  document.body.classList.toggle('pt-top10-moderator',canManage);
  load();
 }).catch(error=>{console.error(error);location.replace('./')});
})();