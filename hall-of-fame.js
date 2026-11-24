(()=>{
'use strict';
const URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.DartArenaSupabaseClient||(window.DartArenaSupabaseClient=window.supabase.createClient(URL,KEY));
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[
 {id:'501',name:'501',metrics:[['180','Flest 180'],['140','Flest 140+'],['100','Flest 100+'],['fast_leg','Raskeste leg'],['checkout','Høyeste utgang'],['avg','Høyeste AVG']]},
 {id:'half_standard',name:'Half-It Standard',metrics:[['score','Høyeste poengsum']]},
 {id:'half_dartcounter',name:'Half-It DartCounter',metrics:[['score','Høyeste poengsum']]},
 {id:'jdc',name:'JDC Challenge',metrics:[['score','Høyeste poengsum']]},
 {id:'pentathlon',name:'Pentathlon',metrics:[['score','Høyeste totalpoeng']]}
];
const date=x=>{if(!x)return'–';const d=new Date(x);return Number.isNaN(d.getTime())?'–':new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)};
let category='501',metric='180',isAdmin=false,uid=null,busy=false,request=0;
$('hofBack').onclick=()=>location.assign('./');
function tabs(){
 $('hofCategories').innerHTML=categories.map(c=>'<button type="button" role="tab" aria-selected="'+(c.id===category)+'" data-category="'+c.id+'">'+esc(c.name)+'</button>').join('');
 const cat=categories.find(c=>c.id===category);
 $('hofMetrics').innerHTML=cat.metrics.map(([id,name])=>'<button type="button" role="tab" aria-selected="'+(id===metric)+'" data-metric="'+id+'">'+esc(name)+'</button>').join('');
 $('hofTitle').textContent=cat.metrics.find(m=>m[0]===metric)?.[1]||'Top 10';
 $('hofCategories').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{
   category=b.dataset.category;metric=categories.find(c=>c.id===category).metrics[0][0];tabs();load();
 });
 $('hofMetrics').querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{metric=b.dataset.metric;tabs();load()});
}
async function getRows(){
 if(category==='pentathlon'){
  const {data,error}=await db.rpc('get_pentathlon_online_top10');if(error)throw error;
  return (data||[]).map(r=>({...r,record_value:Number(r.best_score),record_id:null}));
 }
 if(category==='jdc'){
  const {data,error}=await db.from('jdc_challenge_best').select('result_id,user_id,username,best_score,achieved_at')
   .order('best_score',{ascending:false}).order('achieved_at',{ascending:true}).limit(10);
  if(error)throw error;
  return (data||[]).map((r,i)=>({...r,place:i+1,record_value:Number(r.best_score),record_id:r.result_id,is_mine:r.user_id===uid}));
 }
 const {data,error}=await db.rpc('get_hall_of_fame',{p_category:category,p_metric:metric});
 if(error)throw error;
 return data||[];
}
function displayNumber(r){
 const n=Number(r.record_value);
 if(!Number.isFinite(n))return'–';
 if(metric==='avg')return n.toFixed(2);
 if(metric==='fast_leg')return Math.round(n)+' piler';
 return Math.round(n).toLocaleString('nb-NO')+(category==='501'?'':' P');
}
async function remove(row,button){
 if(!isAdmin||busy)return;
 if(!['jdc','pentathlon'].includes(category))return;
 const dialog=window.DartArenaDialog;
 if(!dialog?.confirm){alert('Bekreftelsesvinduet er ikke tilgjengelig.');return}
 const ok=await dialog.confirm('Fjerne '+displayNumber(row)+' for '+(row.username||'spilleren')+' fra topplisten?\n\nEt annet gyldig resultat kan rykke opp.',{title:'Slett Top 10-resultat',tone:'danger',confirmText:'Slett resultat'});
 if(!ok)return;
 button.disabled=true;
 const result=category==='jdc'
  ?await db.rpc('admin_delete_jdc_result',{p_result_id:Number(row.record_id)})
  :await db.rpc('admin_delete_pentathlon_top10_result',{p_user_id:row.user_id,p_expected_score:Number(row.record_value)});
 if(result.error){button.disabled=false;await dialog.alert('Kunne ikke slette: '+result.error.message,{title:'Feil',tone:'danger'});return}
 load();
}
async function load(){
 const token=++request;busy=true;$('hofRefresh').disabled=true;
 $('hofRows').innerHTML='<div class="hof-empty">Laster topplisten…</div>';$('hofPersonal').hidden=true;
 const notes={
  '501':'Kun fullførte 501-onlinekamper og turneringskamper. Ingen lokale kamper eller oppvarming. Én plass per spiller.',
  'half_standard':'Half-It Standard og DartCounter holdes adskilt. Kun fullførte onlinekamper, ikke lokal trening.',
  'half_dartcounter':'Half-It DartCounter og Standard holdes adskilt. Kun fullførte onlinekamper, ikke lokal trening.',
  'jdc':'Offisielle online JDC-rekorder. Lokale treningsresultater teller ikke.',
  'pentathlon':'Samlet score fra sju fullførte øvelser. Resultater fjernet av Owner/Admin er utelatt.'
 };
 $('hofNote').textContent=notes[category];
 try{
  const rows=await getRows();if(token!==request)return;
  const top=rows.filter(r=>Number(r.place)<=10);
  const manage=isAdmin&&['pentathlon','jdc'].includes(category);
  $('hofHead').classList.toggle('is-admin',manage);
  $('hofHead').innerHTML='<span>#</span><span>Spiller</span><span style="text-align:right">Resultat</span><span class="hof-date">Dato</span>'+(manage?'<span></span>':'');
  const mine=rows.find(r=>r.is_mine);
  if(mine){$('hofPersonal').hidden=false;$('hofPersonal').textContent='Din beste: '+displayNumber(mine)+' · Plass '+mine.place}
  $('hofRows').innerHTML=top.length?top.map(row=>
    '<div class="hof-record'+(row.is_mine?' mine':'')+(manage?' is-admin':'')+'">'+
    '<b class="hof-rank">'+Number(row.place)+'</b>'+
    '<span class="hof-name"><span class="da-role-player" data-user-id="'+esc(row.user_id)+'">'+esc(row.username||'Spiller')+'</span></span>'+
    '<span class="hof-value">'+esc(displayNumber(row))+'</span>'+
    '<span class="hof-date">'+esc(date(row.achieved_at))+'</span>'+
    (manage?'<button type="button" class="small-btn danger hof-delete" data-place="'+Number(row.place)+'">Slett</button>':'')+
    '</div>'
  ).join(''):'<div class="hof-empty">Ingen gyldige resultater i denne kategorien ennå.</div>';
  if(manage)$('hofRows').querySelectorAll('.hof-delete').forEach(b=>{
   const row=top.find(r=>Number(r.place)===Number(b.dataset.place));
   if(row)b.onclick=()=>remove(row,b);
  });
  window.DartArenaRoleVisuals?.scan?.($('hofRows'));
 }catch(e){if(token===request){console.error('[Hall of Fame]',e);$('hofRows').innerHTML='<div class="hof-empty">Kunne ikke laste rekordene. Prøv Oppdater.</div>'}}
 finally{if(token===request){busy=false;$('hofRefresh').disabled=false}}
}
$('hofRefresh').onclick=load;
db.auth.getSession().then(async({data:{session}})=>{
 if(!session)return location.replace('./');
 uid=session.user.id;const {data}=await db.rpc('is_admin');isAdmin=data===true;
 const hash=location.hash.slice(1);
 if(categories.some(c=>c.id===hash)){category=hash;metric=categories.find(c=>c.id===hash).metrics[0][0]}
 tabs();load();
}).catch(e=>{console.error(e);location.replace('./')});
})();