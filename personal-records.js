/* Personal records for solo training; JDC uses its official saved scores. */
(()=>{
'use strict';
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
const results=window.DartArenaResults;
if(!db||!results?.showSolo)return;
const old=results.showSolo;
const number=v=>Number.isFinite(Number(v))?Math.round(Number(v)):0;
const type=()=>{
 const p=location.pathname;
 if(p.endsWith('/61.html'))return {game:'61',variant:null,label:'Høyeste ut'};
 if(p.endsWith('/half-it-solo.html'))return {game:'half_it',variant:new URLSearchParams(location.search).get('mode')==='standard'?'standard':'dartcounter',label:'Høyeste sluttscore'};
 if(p.endsWith('/jdc-challenge.html'))return {game:'jdc',variant:'challenge',label:'Høyeste poengsum'};
 return null;
};
function infoBlock(){
 const card=document.querySelector('#dartArenaResultOverlay .da-result-card');
 if(!card)return null;
 let el=card.querySelector('#daPersonalRecord');
 if(!el){
  el=document.createElement('section');el.id='daPersonalRecord';
  el.style.cssText='margin:8px 0;padding:9px 12px;border:1px solid #087f8b;border-radius:10px;background:#061e23;color:#dcfaff;font-size:12px;text-align:center';
  const actions=card.querySelector('.da-result-actions');
  if(actions)card.insertBefore(el,actions);else card.append(el);
 }
 return el;
}
const niceDate=s=>s?new Date(s).toLocaleDateString('nb-NO'):'';
async function update(opts){
 const t=type(),box=infoBlock();
 if(!box||!t)return;
 box.textContent='Laster personlig rekord…';
 try{
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)throw authError||new Error('Du må være innlogget');
 let variant=t.variant,value=number(opts.score),prior=null,after=[],date='';
 if(t.game==='61'){
  variant=String(parseInt(opts.subtitle,10));
  const high=opts.stats?.find(s=>String(s.label).toUpperCase()==='HØYESTE UT');
  value=number(high?.value);
 }
 if(t.game==='jdc'){
  const {data,error}=await db.from('jdc_challenge_results').select('score,created_at').eq('user_id',user.id).eq('result_source','solo').order('created_at',{ascending:false}).limit(250);
  if(error)throw error;
  after=data||[];
  prior=after.slice(1).reduce((m,r)=>Math.max(m,number(r.score)),Number.NEGATIVE_INFINITY);
  if(!Number.isFinite(prior))prior=null;
 } else {
  const {data,error}=await db.from('personal_training_results').select('score,created_at').eq('user_id',user.id).eq('game',t.game).eq('variant',variant).order('created_at',{ascending:false}).limit(250);
  if(error)throw error;
  const before=data||[];
  prior=before.reduce((m,r)=>Math.max(m,number(r.score)),Number.NEGATIVE_INFINITY);
  if(!Number.isFinite(prior))prior=null;
  const detail=t.game==='61'?{end_target:number(opts.score),duration_minutes:Number(variant)}:{rounds:12};
  const saved=await db.from('personal_training_results').insert({user_id:user.id,game:t.game,variant,score:value,details:detail});
  if(saved.error)throw saved.error;
  after=[{score:value,created_at:new Date().toISOString()},...before];
 }
 const best=after.reduce((b,r)=>!b||number(r.score)>number(b.score)?r:b,null);
 const newBest=prior===null||value>prior;
 const label=document.createElement('strong');label.textContent=newBest?'NY PERSONLIG REKORD!':'PERSONLIG REKORD';label.style.color=newBest?'#f6c34f':'#16e6ed';
 const detail=document.createElement('div');detail.textContent=t.label+': '+(best?number(best.score):'–')+' • '+niceDate(best?.created_at);
 const latest=document.createElement('div');latest.textContent='Siste: '+after.slice(0,3).map(r=>number(r.score)).join(' · ');latest.style.opacity='.8';
 if(box.isConnected)box.replaceChildren(label,detail,latest);
 }catch(error){
  console.warn('[PERSONAL RECORDS]',error);
  if(box.isConnected)box.textContent='Personlig rekord ble ikke lagret eller lastet. Sjekk innlogging og prøv igjen.';
 }
}
results.showSolo=function(opts){const value=old.call(this,opts);void update(opts);return value};
})();