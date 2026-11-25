(function(root){
'use strict';
const fields={nickname:40,country:60,club:80,equipment:100,bio:300};
function clean(row){return Object.fromEntries(Object.entries(fields).map(([k,max])=>[k,typeof row?.[k]==='string'?row[k].trim().slice(0,max):'']))}
function initial(name){return Array.from(String(name||'?').trim())[0]?.toUpperCase()||'?'}
function boot(w){
 const d=w.document,host=d.getElementById('playerDetails'),client=w.DartArenaSupabaseClient;
 const uid=new URLSearchParams(w.location.search).get('id');if(!host||!client||!uid)return;
 const $=id=>d.getElementById(id),dialog=$('playerDetailsDialog'),form=$('playerDetailsForm'),edit=$('editPlayerDetails'),save=$('savePlayerDetails'),status=$('playerDetailsSaveStatus');
 let record=clean({}),own=false,loaded=false;
 const t=s=>w.DartArenaI18n?.t?.(s)||s;
 function render(){
  $('profileAvatar').textContent=initial(record.nickname||$('playerName').textContent);
  $('playerDetailsSummary').textContent=[record.nickname,record.country,record.club].filter(Boolean).join(' · ');
  $('playerBio').textContent=record.bio;
  const equipment=$('playerEquipment');equipment.replaceChildren();
  if(record.equipment){const label=d.createElement('span');label.textContent=t('Piler / utstyr');const value=d.createElement('strong');value.setAttribute('data-no-i18n','');value.textContent=record.equipment;equipment.append(label,value)}
  equipment.hidden=!record.equipment;
  $('playerDetailsStatus').textContent=Object.values(record).some(Boolean)?'':t(own?'Fyll ut profilen din hvis du ønsker.':'Ingen ekstra spilleropplysninger ennå.');
  edit.hidden=!own||!loaded;
 }
 edit.onclick=()=>{if(!own||!loaded)return;for(const k of Object.keys(fields))form.elements[k].value=record[k];status.textContent='';dialog.showModal()};
 $('closePlayerDetails').onclick=()=>dialog.close();
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!own||!loaded||save.disabled)return;
  const payload=clean(Object.fromEntries(Object.keys(fields).map(k=>[k,form.elements[k].value])));
  save.disabled=true;status.textContent=t('Lagrer…');
  try{const {error}=await client.from('player_details').upsert({user_id:uid,...payload},{onConflict:'user_id'});if(error)throw error;record=payload;render();dialog.close();$('playerDetailsStatus').textContent=t('Profil lagret.')}
  catch{status.textContent=t('Kunne ikke lagre profilen. Prøv igjen.')}finally{save.disabled=false}
 });
 async function load(){
  const {data:{session}}=await client.auth.getSession();if(!session)return;
  own=session.user.id===uid;
  const {data,error}=await client.from('player_details').select('nickname,country,club,equipment,bio').eq('user_id',uid).maybeSingle();
  if(error)throw error;record=clean(data);loaded=true;host.hidden=false;render();
  new MutationObserver(()=>{$('profileAvatar').textContent=initial(record.nickname||$('playerName').textContent)}).observe($('playerName'),{childList:true,subtree:true,characterData:true});
 }
 load().catch(()=>{host.hidden=false;edit.hidden=true;$('playerDetailsStatus').textContent=t('Kunne ikke laste spilleropplysninger.')});
}
const api={clean,initial,boot};if(typeof module==='object'&&module.exports)module.exports=api;else boot(root);
})(typeof window!=='undefined'?window:globalThis);
