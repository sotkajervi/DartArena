/* Cloud practice history: AI Rival and local Head-to-Head only. */
(()=>{
'use strict';
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
if(!db)return;
const category=document.body.dataset.practiceCategory;
if(new URLSearchParams(location.search).has('tournamentAiMatch'))return; // Tournament AI results use their own authenticated RPC.
if(!['ai_rival','head_to_head'].includes(category))return;
const key=category==='ai_rival'?'dartarena-ai-rival-501-state-v1':'dartarena-local-h2h-state-v1';
const historyKey='dartarena-local-h2h-history-v1';
const sessionKey=category==='ai_rival'?'dartarena-ai-rival-501-bot-session-v1':'dartarena-local-h2h-bot-session-v1';
const deletedKey=historyKey+'-deleted-ids';
const ownershipKey='dartarena-practice-owner-'+category;
const status=document.createElement('div');status.id='practiceCloudStatus';status.className='muted compact';status.style.margin='12px 0';
const parent=document.querySelector('.local-h2h-heading')||document.querySelector('main');
parent?.after(status);
let uid=null,working=false,queued=false,lastSynced='',staff=false,showAll=false;
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
function validId(v){return typeof v==='string'&&v.length>0&&v.length<=128&&/^[a-z0-9-]+$/i.test(v)}
const cloudId=id=>uid+':'+id;
function sanitize(s){return s&&validId(s.id)&&['playing','between','finished'].includes(s.status)&&Array.isArray(s.visits)&&Array.isArray(s.players)?s:null}
async function saveOne(s,kind,isCurrent=false){
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
 const settings=isCurrent?{botSession:read(sessionKey),rivalId:category==='ai_rival'?new URLSearchParams(location.search).get('player'):null}:{};
 const payload={id,user_id:uid,category:kind,state:s,settings,status:s.status,updated_at:new Date().toISOString()};
 if(existing){const {error}=await db.from('practice_matches').update({state:s,settings,status:s.status,updated_at:payload.updated_at}).eq('id',id);if(error)throw error}
 else {const {error}=await db.from('practice_matches').insert(payload);if(error)throw error}
}
async function sync(){
 if(!uid)return;
 if(working){queued=true;return}
 working=true;
 try{
  const cacheOwner=localStorage.getItem(ownershipKey);
  if(cacheOwner&&cacheOwner!==uid){status.textContent='Lokal kamp tilhører en annen DartArena-konto. Den blir ikke lastet opp. Logg inn på riktig konto for å hente den.';return}
  const current=sanitize(read(key));
  if(current){
   const stamp=JSON.stringify(current);
   if(stamp!==lastSynced){await saveOne(current,category,true);lastSynced=stamp;localStorage.setItem(ownershipKey,uid)}
  }
  if(category==='head_to_head'){
   const archived=read(historyKey),deleted=new Set(read(deletedKey)||[]);
   if(Array.isArray(archived)){
    const migratedKey='dartarena-cloud-migrated-h2h-v1-'+uid;
    const uploaded=new Set(read(migratedKey)||[]);
    let count=0;
    for(const entry of archived){
     if(count>=20)break;
     if(!validId(entry?.id)||deleted.has(entry.id)||uploaded.has(entry.id))continue;
     if(!sanitize({...entry,status:'finished'}))continue;
     const state={...entry,status:'finished'};
     await saveOne(state,'head_to_head');
     uploaded.add(entry.id);count++;
    }
    localStorage.setItem(migratedKey,JSON.stringify([...uploaded].slice(-500)));
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
function renderPracticeTrends(finished){
 const host=document.getElementById('practiceCloudTotals');
 let chart=document.getElementById('practiceCloudTrends');
 if(!chart){chart=document.createElement('div');chart.id='practiceCloudTrends';chart.style.cssText='padding:14px 0;margin:12px 0;border-top:1px solid #2c5054';host.after(chart)}
 chart.replaceChildren();
 const heading=document.createElement('h3');heading.textContent='Formkurve – '+(category==='ai_rival'?'AI Rival':'Head-to-Head');chart.append(heading);
 const cards=finished.slice().reverse().map(match=>{
  const visits=(match.state?.visits||[]).filter(v=>v.player===0);
  const darts=visits.reduce((n,v)=>n+(v.checkout?Math.max(1,Math.min(3,Number(v.darts)||3)):3),0);
  const score=visits.reduce((n,v)=>n+Number(v.score||0),0);
  const checkout=visits.filter(v=>v.checkout);
  return {avg:darts?score/darts*3:0,fast:(()=>{
   let min=Infinity;
   for(const end of checkout){const leg=visits.filter(v=>v.leg===end.leg&&(v.set||1)===(end.set||1));const count=leg.reduce((n,v)=>n+(v.checkout?Number(v.darts)||3:3),0);if(count>0)min=Math.min(min,count)}
   return Number.isFinite(min)?min:null})(),high:Math.max(0,...checkout.map(v=>Number(v.score)||0))};
 }).slice(-20);
 if(!cards.length){const e=document.createElement('p');e.className='muted compact';e.textContent='Formkurven vises når du har fullført en kamp.';chart.append(e);return}
 const bars=document.createElement('div');bars.style.cssText='display:flex;align-items:end;gap:5px;min-height:125px;overflow-x:auto;padding:12px 2px 4px';
 const max=Math.max(60,...cards.map(c=>c.avg));
 cards.forEach((c,i)=>{
  const outer=document.createElement('div');outer.style.cssText='display:flex;flex-direction:column;align-items:center;gap:3px;min-width:25px;flex:1';
  const number=document.createElement('small');number.textContent=c.avg.toFixed(0);number.style.fontSize='10px';
  const bar=document.createElement('div');bar.style.cssText='width:100%;max-width:34px;min-height:2px;border-radius:5px 5px 0 0;background:#16d0c9;height:'+Math.max(2,Math.round(c.avg/max*95))+'px';
  outer.title='Kamp '+(i+1)+' · Snitt '+c.avg.toFixed(2)+' · Høyeste checkout '+c.high;
  outer.append(number,bar);bars.append(outer);
 });
 chart.append(bars);
 const details=document.createElement('p');details.className='muted compact';details.textContent='Siste '+cards.length+' kamper · Høyeste checkout: '+Math.max(...cards.map(c=>c.high))+' · Raskeste leg: '+(Math.min(...cards.map(c=>c.fast||Infinity))===Infinity?'–':Math.min(...cards.map(c=>c.fast||Infinity))+' piler');
 chart.append(details);
}
function practiceDialog(title,description,confirmText,action){
 const overlay=document.createElement('div');
 overlay.className='local-modal';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.style.zIndex='9999';
 const backdrop=document.createElement('div');backdrop.className='local-modal-backdrop';
 const panel=document.createElement('div');panel.className='card local-modal-card';
 panel.style.maxWidth='520px';
 const tag=document.createElement('small');tag.textContent=category==='ai_rival'?'AI RIVAL':'HEAD-TO-HEAD';tag.style.color='#24d6d0';
 const heading=document.createElement('h2');heading.textContent=title;
 const body=document.createElement('p');body.className='muted';body.textContent=description;
 const actions=document.createElement('div');actions.className='local-checkout-actions';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='outline';cancel.textContent='Avbryt';
 const confirmButton=document.createElement('button');confirmButton.type='button';confirmButton.className='primary';confirmButton.textContent=confirmText;
 const feedback=document.createElement('p');feedback.className='local-message is-error';feedback.hidden=true;
 actions.append(cancel,confirmButton);panel.append(tag,heading,body,feedback,actions);overlay.append(backdrop,panel);document.body.append(overlay);
 const previous=document.activeElement;
 const close=()=>{document.removeEventListener('keydown',escape);overlay.remove();previous?.focus?.()};
 const escape=e=>{if(e.key==='Escape'){e.preventDefault();close()}};
 document.addEventListener('keydown',escape);
 cancel.onclick=close;backdrop.onclick=close;
 confirmButton.onclick=async()=>{
  confirmButton.disabled=true;cancel.disabled=true;
  try{await action();close()}
  catch(e){feedback.textContent=e.message||'Handlingen mislyktes';feedback.hidden=false;confirmButton.disabled=false;cancel.disabled=false}
 };
 cancel.focus();
}
function openPracticeMatchStats(item){
 const state=item.state||{},visits=Array.isArray(state.visits)?state.visits:[];
 const names=state.players||['Spiller 1','Spiller 2'];
 const num=value=>Number(value)||0;
 const final= item.status==='finished';
 const winnerIndex=Number.isInteger(state.winner)?state.winner:(Array.isArray(state.legs)&&state.legs[0]!==state.legs[1]?(state.legs[0]>state.legs[1]?0:1):null);
 const winnerName=winnerIndex===null?'':names[winnerIndex]||'Spiller';
 const box=document.createElement('div');
 box.className='da-practice-stats-overlay';
 box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Kampstatistikk');
 box.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,8,10,.88);display:flex;align-items:center;justify-content:center;padding:16px';
 const content=document.createElement('div');
 content.style.cssText='width:min(1080px,100%);max-height:94vh;overflow-y:auto;position:relative;background:#091719;border:1px solid #00bdc8;border-radius:20px;padding:clamp(16px,3vw,32px);box-shadow:0 30px 100px #000b';
 const header=document.createElement('div');header.className='premium-stats-head';
 const label=document.createElement('div');
 const kicker=document.createElement('small');kicker.textContent='KAMPSTATISTIKK · AI RIVAL';
 const heading=document.createElement('h1');heading.textContent=names.join(' vs ');heading.style.cssText='font-size:clamp(21px,3vw,34px);line-height:1.2;margin:9px 0 4px';
 label.append(kicker,heading);
 const close=document.createElement('button');close.type='button';close.className='outline';close.textContent='Lukk';
 header.append(label,close);header.style.cssText='display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:22px';content.append(header);
 const section=document.createElement('section');section.className='premium-result-card';section.style.cssText='border:1px solid #00bac5;border-radius:20px;padding:clamp(16px,2.5vw,26px);background:#07191c;text-align:center';
 const title=document.createElement('div');title.className='premium-result-kicker';title.textContent=item.status==='finished'?'KAMP FERDIG':'PÅGÅENDE KAMP';
 const format=document.createElement('div');format.className='premium-result-sub';format.textContent=(state.format||'501')+' · '+new Date(item.updated_at).toLocaleString('no-NO');
 section.append(title);
 if(final&&winnerName){const champion=document.createElement('h2');champion.textContent=winnerName+' vant!';champion.style.cssText='font-weight:900;font-size:clamp(28px,4vw,43px);margin:7px 0;color:#f2c064';section.append(champion)}
 section.append(format);
 if(Array.isArray(state.legs)){
  const score=document.createElement('div');score.className='premium-result-score';
  score.textContent=state.legs.join(' – ');score.style.cssText='font-size:clamp(42px,6vw,62px);font-weight:900;line-height:1.2;display:inline-block;padding:4px 24px;margin:14px auto 20px;background:#0a272b;border:1px solid #00b9c4;border-radius:13px;color:#f2fbfc';
  section.append(score);
 }
 const grid=document.createElement('div');grid.className='premium-player-grid';grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;text-align:left;margin:0 0 16px';
 for(let i=0;i<2;i++){
  const rows=visits.filter(v=>num(v.player)===i);
  const darts=rows.reduce((sum,v)=>sum+(v.checkout?Math.max(1,Math.min(3,num(v.darts)||3)):3),0);
  const total=rows.reduce((sum,v)=>sum+num(v.score),0);
  const first9=rows.filter(v=>Number(v.leg||1)===1).slice(0,3);
  const checkouts=rows.filter(v=>v.checkout);
  const completed=checkouts.map(c=>rows.filter(v=>Number(v.leg||1)===Number(c.leg||1)&&Number(v.set||1)===Number(c.set||1)).reduce((sum,v)=>sum+(v.checkout?(num(v.darts)||3):3),0)).filter(Boolean);
  const values=[
   ['AVG',darts?(total/darts*3).toFixed(2):'–'],
   ['FIRST 9',first9.length===3?(first9.reduce((n,v)=>n+num(v.score),0)/9*3).toFixed(2):'–'],
   ['HØYESTE UT',checkouts.length?Math.max(...checkouts.map(v=>num(v.score))):'–'],
   ['RASKESTE LEG',completed.length?Math.min(...completed)+' piler':'–'],
   ['100+',rows.filter(v=>num(v.score)>=100).length],
   ['140+',rows.filter(v=>num(v.score)>=140).length],
   ['170+',rows.filter(v=>num(v.score)>=170).length],
   ['180',rows.filter(v=>num(v.score)===180).length]
  ];
  const card=document.createElement('article');card.className='premium-player-card';card.style.cssText='min-width:0;border:1px solid '+(final&&winnerIndex===i?'#edbd55':'#006c78')+';border-radius:15px;padding:17px;background:#071619;'+(final&&winnerIndex===i?'box-shadow:inset 3px 0 #edbd55;':'');
  const head=document.createElement('div');head.className='premium-player-head';
  const name=document.createElement('div');name.className='premium-player-name da-role-player';name.textContent=names[i]||'Spiller '+(i+1);
  const profileId=i===0?item.user_id:null;
  if(profileId)name.dataset.userId=profileId;
  if(final&&winnerIndex===i){const crown=document.createElement('span');crown.textContent='♛';crown.style.cssText='font-size:25px;color:#f2c064;margin-right:9px';head.append(crown)}
 head.append(name);
 if(final&&winnerIndex===i){const badge=document.createElement('small');badge.textContent='VINNER';badge.style.cssText='color:#f2c064;border:1px solid #bd913f;border-radius:20px;padding:2px 7px;font-size:10px';head.append(badge)}
 head.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:15px';card.append(head);
  const metrics=document.createElement('div');metrics.className='premium-stat-grid';
  for(const [key,value] of values){
   const cell=document.createElement('div');cell.className='premium-stat';
   const label=document.createElement('span');label.textContent=key;
   const val=document.createElement('b');val.textContent=String(value);
   cell.append(label,val);metrics.append(cell);
  }
  card.append(metrics);grid.append(card);
 }
 section.append(grid);
 window.DartArenaRoleVisuals?.scan(grid);
 const legs=document.createElement('section');legs.className='premium-leg-section';legs.style.cssText='margin-top:15px;padding:13px;border:1px solid #213f45;border-radius:13px;text-align:left;background:#081417';
 const legHead=document.createElement('div');legHead.className='premium-leg-title';legHead.textContent='LEG-OVERSIKT';
 const list=document.createElement('div');list.className='premium-leg-list';
 const keys=[...new Set(visits.map(v=>String(v.set||1)+':'+String(v.leg||1)))];
 for(const key of keys){
  const [set,leg]=key.split(':').map(Number);
  const all=visits.filter(v=>num(v.set||1)===set&&num(v.leg||1)===leg);
  const finished=all.find(v=>v.checkout);
  const line=document.createElement('div');line.className='premium-leg-row';
  const label=document.createElement('span');label.className='premium-leg-label';label.textContent='Leg '+leg;
  const winner=document.createElement('span');winner.className='premium-leg-winner';winner.textContent=finished?(names[num(finished.player)]||'Spiller'):'Ikke avgjort';
  const meta=document.createElement('span');meta.className='premium-leg-meta';
  const winnerRows=finished?all.filter(v=>num(v.player)===num(finished.player)):[];
  meta.textContent=finished?winnerRows.reduce((n,v)=>n+(v.checkout?(num(v.darts)||3):3),0)+' piler · checkout '+num(finished.score):'–';
  line.append(label,winner,meta);list.append(line);
 }
 if(!keys.length){const no=document.createElement('p');no.className='premium-empty';no.textContent='Ingen kast registrert.';list.append(no)}
 legs.append(legHead,list);section.append(legs);content.append(section);box.append(content);document.body.append(box);
 const before=document.activeElement,scroll=document.body.style.overflow;document.body.style.overflow='hidden';
 const dismiss=()=>{document.removeEventListener('keydown',onKey);box.remove();document.body.style.overflow=scroll;before?.focus?.()};
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();dismiss()}};
 document.addEventListener('keydown',onKey);
 close.onclick=dismiss;box.addEventListener('click',e=>{if(e.target===box)dismiss()});close.focus();
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
 let request=db.from('practice_matches').select('id,user_id,category,status,state,settings,updated_at,deleted_at').eq('category',category).is('deleted_at',null).order('updated_at',{ascending:false}).limit(200);
 if(!staff||!showAll)request=request.eq('user_id',uid);
 const {data,error}=await request;
 if(error){rows.textContent='Kunne ikke hente kamper: '+error.message;return}
 const mine=data||[];
 rows.replaceChildren();
 if(!mine.length){rows.textContent='Ingen lagrede kamper ennå.';document.getElementById('practiceCloudTotals').textContent='';document.getElementById('practiceCloudTrends')?.remove();return}
 const finished=mine.filter(m=>m.status==='finished'&&m.user_id===uid);
 const visits=finished.flatMap(m=>(m.state?.visits||[]).filter(v=>v.player===0));
 const darts=visits.reduce((n,v)=>n+(v.checkout?Number(v.darts)||3:3),0);
 const total=visits.reduce((n,v)=>n+Number(v.score||0),0);
 const avg=darts?((total/darts)*3).toFixed(2):'–';
 const hundreds=visits.filter(v=>Number(v.score)>=100).length;
 const c140=visits.filter(v=>Number(v.score)>=140).length;
 const c180=visits.filter(v=>Number(v.score)===180).length;
 document.getElementById('practiceCloudTotals').textContent='Mine ferdige kamper: '+finished.length+' · 3-dart-snitt: '+avg+' · 100+: '+hundreds+' · 140+: '+c140+' · 180: '+c180+' (basert på viste kamper)';
 renderPracticeTrends(finished);
 for(const item of mine){
  const div=document.createElement('div');div.style.cssText='border-top:1px solid #325055;padding:10px 0;display:flex;justify-content:space-between;gap:12px;align-items:center';
  const label=document.createElement('span');
  const s=item.state||{};
  label.textContent=[new Date(item.updated_at).toLocaleString('no-NO'),s.players?.join(' mot ')||'',item.status==='finished'?'Ferdig':'Pågående',Array.isArray(s.legs)?'Legs '+s.legs.join('–'):'',showAll&&staff?'Konto: '+item.user_id.slice(0,8):''].filter(Boolean).join(' · ');
  const button=document.createElement('button');button.type='button';button.textContent='Slett';button.className='outline';
  button.onclick=()=>practiceDialog('Slette kamp?','Denne kampen fjernes fra Supabase-historikken. Handlingen kan ikke angres.','Slett kamp',async()=>{
   const {data:removed,error:err}=await db.rpc('practice_soft_delete',{p_id:item.id});
   if(err||!removed)throw Error(err?.message||'Sletting er ikke tillatt.');
   if(cloudId(read(key)?.id)===item.id){localStorage.removeItem(key);localStorage.removeItem(sessionKey)}
   if(category==='head_to_head'&&item.user_id===uid){
    window.DartArenaH2HHistory?.remove(String(item.state?.id||''));
   }
   await showCloudHistory();
  });
  div.append(label);
  if(item.status!=='finished'&&item.user_id===uid){
   const resume=document.createElement('button');resume.type='button';resume.className='outline';resume.textContent='Fortsett';
   resume.onclick=()=>{
    const local=read(key);
    if(local?.id!==item.state?.id&&local?.status!=='finished'&&local&&!confirm('Erstatte pågående lokal kamp med kampen fra Supabase?'))return;
    localStorage.setItem(key,JSON.stringify(item.state));
    localStorage.setItem(ownershipKey,uid);
    if(item.settings?.botSession)localStorage.setItem(sessionKey,JSON.stringify(item.settings.botSession));
    else localStorage.removeItem(sessionKey);
    if(category==='ai_rival'){
     const selected=item.settings?.rivalId;
     if(!selected){alert('Denne AI Rival-kampen mangler spillerreferanse og kan ikke gjenopptas på ny enhet.');return}
     localStorage.setItem('dartarena-ai-rival-501-selected-player',selected);
     location.href='ai-rival-501.html?player='+encodeURIComponent(selected);
    }else location.reload();
   };
   div.append(resume);
  }
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  const details=document.createElement('button');details.type='button';details.className='outline';details.textContent='Kampstatistikk';
  details.onclick=()=>openPracticeMatchStats(item);
  actions.append(details,button);div.append(actions);rows.append(div);
 }
}
window.addEventListener('dartarena:practice-save',()=>{sync().then(()=>{if(read(key)?.status==='finished')showCloudHistory()})});
window.addEventListener('online',()=>sync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
init().catch(err=>{status.textContent='Kunne ikke starte skylagring: '+err.message});
})();