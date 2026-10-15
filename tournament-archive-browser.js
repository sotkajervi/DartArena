(()=>{
'use strict';
const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
const $=id=>document.getElementById(id),status=$('archiveStatus'),rows=$('archiveRows');
async function load(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){status.textContent='Logg inn for å se arkivet.';return}
 const {data:role}=await db.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
 const owner=role?.role==='owner';
 const {data,error}=await db.from('tournaments').select('id,name,status,archived_at').not('archived_at','is',null).order('archived_at',{ascending:false}).limit(200);
 if(error){status.textContent='Kunne ikke hente arkivet: '+error.message;return}
 rows.replaceChildren();status.textContent=(data||[]).length+' arkiverte turneringer';
 for(const t of data||[]){
  const row=document.createElement('div');row.className='archive-row';
  const name=document.createElement('a');name.href='./tournament.html?id='+encodeURIComponent(t.id);name.textContent=t.name||'Turnering';
  const box=document.createElement('div'),date=document.createElement('small');date.textContent='Arkivert '+new Date(t.archived_at).toLocaleDateString('no-NO')+' · '+t.status;
  box.append(name,date);row.append(box);
  if(owner){
   const button=document.createElement('button');button.type='button';button.textContent='Gjenopprett fra arkiv';
   button.onclick=async()=>{if(!confirm('Ta turneringen ut av arkivet? Resultatene beholdes.'))return;button.disabled=true;
    const {data:ok,error:e}=await db.rpc('owner_restore_tournament',{p_tournament_id:t.id});
    if(e||!ok){alert('Kunne ikke gjenopprette: '+(e?.message||'ikke tillatt'));button.disabled=false;return}
    load();
   };
   row.append(button);
  }
  rows.append(row);
 }
}
load().catch(e=>status.textContent='Feil: '+e.message);
})();