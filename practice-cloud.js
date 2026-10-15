/* Cloud practice history: AI Rival and local Head-to-Head only. */
(()=>{
'use strict';
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
if(!db)return;
const category=document.body.dataset.practiceCategory;
if(!['ai_rival','head_to_head'].includes(category))return;
const key=category==='ai_rival'?'dartarena-ai-rival-501-state-v1':'dartarena-local-h2h-state-v1';
const historyKey='dartarena-local-h2h-history-v1';
const deletedKey=historyKey+'-deleted-ids';
const status=document.createElement('div');status.id='practiceCloudStatus';status.className='muted compact';status.style.margin='12px 0';
const parent=document.querySelector('.local-h2h-heading')||document.querySelector('main');
parent?.after(status);
let uid=null,working=false,queued=false,lastSynced='',staff=false,showAll=false;
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
function uuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
function sanitize(s){return s&&validId(s.id)&&['playing','between','finished'].includes(s.status)&&Array.isArray(s.visits)&&Array.isArray(s.players)?s:null}
async function saveOne(s,kind){
 if(!sanitize(s))return;
 const id=cloudId(s.id);
 const {data:existing,error:e}=await db.from('practice_matches').select('id,deleted_at,status,state').eq('id',id).maybeSingle();
 if(e)throw e;
 if(existing?.deleted_at)return;
 if(existing?.state){
  const serverCount=Array.isArray(existing.state.visits)?existing.state.visits.length:0;
  const localCount=s.visits.length;
  if(serverCount>localCount||(existing.status==='finished'&&s.status!=='finished'))return;
  const remoteAt=Date.parse(existing.state.visits?.at(-1)?.at||'')||0;
  const localAt=Date.parse(s.visits?.at(-1)?.at||'')||0;
  if(remoteAt>localAt)return;
 }
 const payload={id,user_id:uid,category:kind,state:s,status:s.status,updated_at:new Date().toISOString()};
 if(existing){const {error}=await db.from('practice_matches').update({state:s,status:s.status,updated_at:payload.updated_at}).eq('id',id);if(error)throw error}
 else {const {error}=await db.from('practice_matches').insert(payload);if(error)throw error}
}
async function sync(){
 if(!uid)return;
 if(working){queued=true;return}
 working=true;
 try{
  const current=sanitize(read(key));
  if(current){
   const stamp=JSON.stringify(current);
   if(stamp!==lastSynced){await saveOne(current,category);lastSynced=stamp}
  }
  if(category==='head_to_head'){
   const archived=read(historyKey),deleted=new Set(read(deletedKey)||[]);
   if(Array.isArray(archived)){
    for(const entry of archived){
     if(!validId(entry?.id)||deleted.has(entry.id))continue;
     if(!sanitize({...entry,status:'finished'}))continue;
     const state={...entry,status:'finished'};
     await saveOne(state,'head_to_head');
    }
   }
  }
  status.textContent='Skyhistorikk synkronisert med Supabase.';
 }catch(err){status.textContent='Skyhistorikk: synkronisering venter ('+(err.message||'nettverksfeil')+'). Lokalt eksemplar beholdes.'}
 finally{working=false;if(queued){queued=false;sync()}}
}
async function init(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){status.textContent='Logg inn for å lagre praksiskamper i Supabase. Lokalt eksemplar beholdes.';return}
 uid=session.user.id;
 const {data:role}=await db.from('user_roles').select('role').eq('user_id',uid).maybeSingle();
 staff=['admin','owner'].includes(role?.role);
 await sync();showCloudHistory();
}
async function showCloudHistory(){
 if(!uid)return;
 let host=document.getElementById('practiceCloudHistory');
 if(!host){
  host=document.createElement('section');host.id='practiceCloudHistory';host.className='card';
  host.style.marginTop='16px';host.innerHTML='<h2>Kamphistorikk i Supabase</h2><p class="muted compact">Egen historikk for denne spilltypen. Ingen påvirkning på online- eller turneringsstatistikk.</p><div id="practiceCloudTotals"></div><div id="practiceCloudRows"></div>';
  if(staff){const toggle=document.createElement('button');toggle.type='button';toggle.className='outline';toggle.textContent='Vis alle spillere (ADMIN/OWNER)';toggle.onclick=()=>{showAll=!showAll;toggle.textContent=showAll?'Vis bare mine kamper':'Vis alle spillere (ADMIN/OWNER)';showCloudHistory()};host.append(toggle)}
  document.querySelector('main')?.append(host);
 }
 const rows=document.getElementById('practiceCloudRows');
 let request=db.from('practice_matches').select('id,user_id,category,status,state,updated_at,deleted_at').eq('category',category).is('deleted_at',null).order('updated_at',{ascending:false}).limit(200);
 if(!staff||!showAll)request=request.eq('user_id',uid);
 const {data,error}=await request;
 if(error){rows.textContent='Kunne ikke hente kamper: '+error.message;return}
 const mine=data||[];
 rows.replaceChildren();
 if(!mine.length){rows.textContent='Ingen lagrede kamper ennå.';document.getElementById('practiceCloudTotals').textContent='';return}
 const finished=mine.filter(m=>m.status==='finished'&&m.user_id===uid);
 const visits=finished.flatMap(m=>(m.state?.visits||[]).filter(v=>v.player===0));
 const darts=visits.reduce((n,v)=>n+(v.checkout?Number(v.darts)||3:3),0);
 const total=visits.reduce((n,v)=>n+Number(v.score||0),0);
 const avg=darts?((total/darts)*3).toFixed(2):'–';
 const hundreds=visits.filter(v=>Number(v.score)>=100).length;
 const c140=visits.filter(v=>Number(v.score)>=140).length;
 const c180=visits.filter(v=>Number(v.score)===180).length;
 document.getElementById('practiceCloudTotals').textContent='Mine ferdige kamper: '+finished.length+' · 3-dart-snitt: '+avg+' · 100+: '+hundreds+' · 140+: '+c140+' · 180: '+c180+' (basert på viste kamper)';
 for(const item of mine){
  const div=document.createElement('div');div.style.cssText='border-top:1px solid #325055;padding:10px 0;display:flex;justify-content:space-between;gap:12px;align-items:center';
  const label=document.createElement('span');
  const s=item.state||{};
  label.textContent=[new Date(item.updated_at).toLocaleString('no-NO'),s.players?.join(' mot ')||'',item.status==='finished'?'Ferdig':'Pågående',Array.isArray(s.legs)?'Legs '+s.legs.join('–'):'',showAll&&staff?'Konto: '+item.user_id.slice(0,8):''].filter(Boolean).join(' · ');
  const button=document.createElement('button');button.type='button';button.textContent='Slett';button.className='outline';
  button.onclick=async()=>{
   if(!confirm('Slette denne '+(category==='ai_rival'?'AI Rival':'Head-to-Head')+'-kampen fra Supabase?'))return;
   button.disabled=true;
   const {data:removed,error:err}=await db.rpc('practice_soft_delete',{p_id:item.id});
   if(err||!removed){alert('Kunne ikke slette kampen: '+(err?.message||'ikke tillatt'));button.disabled=false;return}
   if(cloudId(read(key)?.id)===item.id)localStorage.removeItem(key);
   if(category==='head_to_head'&&item.user_id===uid){
    window.DartArenaH2HHistory?.remove(String(item.state?.id||''));
   }
   await showCloudHistory();
  };
  div.append(label,button);rows.append(div);
 }
}
window.addEventListener('dartarena:practice-save',()=>{sync().then(()=>{if(read(key)?.status==='finished')showCloudHistory()})});
window.addEventListener('online',()=>sync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
init().catch(err=>{status.textContent='Kunne ikke starte skylagring: '+err.message});
})();