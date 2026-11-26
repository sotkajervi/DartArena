(function(w){
'use strict';
const d=w.document,section=d.getElementById('daSuspensionHistory'),db=w.DartArenaSupabaseClient,target=new URLSearchParams(w.location.search).get('id');
if(!section||!db||!target||!(/^[0-9a-f-]{36}$/i.test(target)))return;
const content=d.getElementById('daSuspensionHistoryContent');
const tr=(no,en)=>w.DartArenaI18n?.getLanguage()==='en'?en:no;
const node=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n};
let generation=0,rows=[],names=new Map(),verified=false,expanded=false;
function hide(){verified=false;rows=[];names.clear();section.hidden=true;content.replaceChildren();}
function date(value){return value?new Date(value).toLocaleString(tr('nb-NO','en-GB')):tr('Permanent','Permanent')}
function status(r){return r.revoked_at?'revoked':!r.ends_at||Date.parse(r.ends_at)>Date.now()?'active':'expired'}
function duration(r){if(!r.ends_at)return tr('Permanent','Permanent');const hours=Math.round((Date.parse(r.ends_at)-Date.parse(r.imposed_at))/3600000);if(hours===24)return tr('24 timer','24 hours');if(hours===168||hours===167||hours===169)return tr('7 dager','7 days');if(hours>=719&&hours<=721)return tr('30 dager','30 days');return hours+' '+tr('timer','hours')}
function name(id){return names.get(id)||id||'–'}
function field(dl,label,value){dl.append(node('dt',label),node('dd',value))}
function render(){
 if(!verified)return;
 d.getElementById('daSuspensionHistoryTitle').textContent=tr('Suspensjonshistorikk','Suspension history');
 const summary=node('div',undefined,'da-suspension-summary');
 for(const [label,count] of [[tr('Totalt','Total'),rows.length],[tr('Aktive','Active'),rows.filter(r=>status(r)==='active').length],[tr('Utløpt','Expired'),rows.filter(r=>status(r)==='expired').length],[tr('Opphevet','Lifted'),rows.filter(r=>status(r)==='revoked').length]]){
  const item=node('div');item.append(node('small',label),node('strong',count));summary.append(item);
 }
 const list=node('div',undefined,'da-suspension-log');
 if(!rows.length)list.append(node('p',tr('Ingen suspensjoner.','No suspensions.'),'muted'));
 for(const r of (expanded?rows:rows.slice(0,5))){
  const item=node('article',undefined,'da-suspension-entry '+status(r));
  const head=node('div',undefined,'da-suspension-entry-head');
  const labels={active:tr('Aktiv','Active'),expired:tr('Utløpt','Expired'),revoked:tr('Opphevet','Lifted')};
  head.append(node('strong',duration(r)),node('span',labels[status(r)],'da-suspension-state'));
  const dl=node('dl');field(dl,tr('Startdato','Start date'),date(r.imposed_at));field(dl,tr('Utløper','Expires'),date(r.ends_at));field(dl,tr('Utført av','Imposed by'),name(r.imposed_by));field(dl,tr('Begrunnelse','Reason'),r.reason);
  if(r.revoked_at){field(dl,tr('Opphevet dato','Lifted on'),date(r.revoked_at));field(dl,tr('Opphevet av','Lifted by'),name(r.revoked_by));field(dl,tr('Begrunnelse for oppheving','Reason for lifting'),r.revocation_reason||'–')}
  item.append(head,dl);list.append(item);
 }
 if(rows.length>5){const more=node('button',expanded?tr('Vis færre','Show fewer'):tr('Vis hele historikken','Show full history'),'outline');more.type='button';more.onclick=()=>{expanded=!expanded;render()};list.append(more)}
 content.replaceChildren(summary,list);
 section.hidden=false;
}
async function refresh(){
 const token=++generation;
 try{
  const {data,error}=await db.auth.getSession();if(token!==generation)return;
  if(error||!data?.session?.user){hide();return}
  const role=await db.rpc('is_admin');if(token!==generation)return;
  if(role.error||role.data!==true){hide();return}
  verified=true;
  const found=[];
  for(let offset=0;;offset+=200){
   const result=await db.from('player_suspensions').select('id,imposed_by,imposed_at,ends_at,reason,revoked_by,revoked_at,revocation_reason').eq('player_id',target).order('imposed_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+199);
   if(token!==generation)return;if(result.error)throw result.error;
   const batch=result.data||[];found.push(...batch);if(batch.length<200)break;
  }
  const ids=[...new Set(found.flatMap(r=>[r.imposed_by,r.revoked_by]).filter(Boolean))],resolved=new Map();
  for(let i=0;i<ids.length;i+=100){
   const result=await db.from('profiles').select('id,username').in('id',ids.slice(i,i+100));if(token!==generation)return;
   if(!result.error)for(const p of result.data||[])if(p.username)resolved.set(p.id,p.username);
  }
  const checked=await db.rpc('is_admin');if(token!==generation)return;
  if(checked.error||checked.data!==true){hide();return}
  rows=found;names=resolved;render();
 }catch{if(token!==generation)return;const allowed=verified;hide();if(allowed){content.append(node('p',tr('Kunne ikke laste suspensjoner.','Could not load suspensions.'),'muted'));section.hidden=false}}
}
db.auth.onAuthStateChange((event)=>{if(['SIGNED_OUT','SIGNED_IN','USER_UPDATED'].includes(event)){generation++;hide();if(event!=='SIGNED_OUT')setTimeout(refresh,0)}});
d.addEventListener('dartarena:languagechange',render);
w.addEventListener('dartarena:suspension-changed',refresh);
w.addEventListener('pageshow',e=>{if(e.persisted)refresh()});
w.addEventListener('focus',refresh);
setInterval(()=>{if(verified&&!d.hidden)render()},30000);
refresh();
})(window);
