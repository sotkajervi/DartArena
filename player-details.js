(function(root){
'use strict';
const fields={nickname:24,country:60,club:80,equipment:100,bio:300,full_name:80};
function clean(row){return Object.fromEntries(Object.entries(fields).map(([k,max])=>[k,typeof row?.[k]==='string'?row[k].trim().slice(0,max):'']))}
function initial(name){return Array.from(String(name||'?').trim())[0]?.toUpperCase()||'?'}
function boot(w){
 const d=w.document,host=d.getElementById('playerDetails'),client=w.DartArenaSupabaseClient;
 const uid=new URLSearchParams(w.location.search).get('id');if(!host||!client||!uid)return;
 const $=id=>d.getElementById(id),dialog=$('playerDetailsDialog'),form=$('playerDetailsForm'),edit=$('editPlayerDetails'),save=$('savePlayerDetails'),status=$('playerDetailsSaveStatus');
 let record=clean({}),own=false,loaded=false,displayName='',changedAt=null,staff=false,displayMode='nick';
 const avatars=w.DartArenaIdentity,avatar=$('profileAvatar');avatar.dataset.avatarId=uid;
 async function drawAvatar(){if(avatars){await avatars.paint(client,avatar);$('removeAvatar').hidden=!avatar.querySelector('img[data-player-avatar]')||(!own&&!staff)}}
 const t=s=>w.DartArenaI18n?.t?.(s)||s;
 function render(){
  const shown=w.DartArenaProfileLink?.display(displayName,record.full_name,displayMode)||displayName;const heading=$('playerName');heading.dataset.userId=uid;heading.textContent=shown;d.title='DartArena • '+shown;
  const letter=initial(shown||heading.textContent);if(avatar.firstChild?.nodeType===3)avatar.firstChild.nodeValue=letter;else avatar.prepend(d.createTextNode(letter));
  $('playerDetailsSummary').textContent=[record.full_name,record.country,record.club].filter(Boolean).join(' · ');
  $('playerBio').textContent=record.bio;
  const equipment=$('playerEquipment');equipment.replaceChildren();
  if(record.equipment){const label=d.createElement('span');label.textContent=t('Piler / utstyr');const value=d.createElement('strong');value.setAttribute('data-no-i18n','');value.textContent=record.equipment;equipment.append(label,value)}
  equipment.hidden=!record.equipment;
  $('playerDetailsStatus').textContent=Object.values(record).some(Boolean)?'':t(own?'Fyll ut profilen din hvis du ønsker.':'Ingen ekstra spilleropplysninger ennå.');
  edit.hidden=(!own&&!staff)||!loaded;
  edit.textContent=t(own?'Rediger profil':'Rediger profil (Admin/Owner)');
  $('avatarControls').hidden=!own&&!staff;
  $('avatarFile').parentElement.hidden=!own&&!staff;
  void drawAvatar();
 }
 edit.onclick=()=>{if((!own&&!staff)||!loaded)return;for(const k of Object.keys(fields))form.elements[k].value=record[k];form.elements.nickname.value=changedAt?displayName:record.nickname;form.elements.display_mode.value=displayMode;preview();status.textContent='';$('playerDetailsEditTitle').textContent=t(own?'Rediger profil':'Rediger profil (Admin/Owner)');dialog.showModal()};
 function preview(){const full=form.elements.full_name.value.trim(),mode=form.elements.display_mode.value,nick=form.elements.nickname.value.trim()||displayName;$('displayNamePreview').textContent=w.DartArenaProfileLink?.display(nick,full,mode)||nick}
 form.elements.full_name.addEventListener('input',preview);form.elements.nickname.addEventListener('input',preview);form.elements.display_mode.addEventListener('change',preview);
 $('closePlayerDetails').onclick=()=>dialog.close();
 form.addEventListener('submit',async e=>{
  e.preventDefault();if((!own&&!staff)||!loaded||save.disabled)return;
  const payload=clean(Object.fromEntries(Object.keys(fields).map(k=>[k,form.elements[k].value])));
  if(payload.nickname&&payload.nickname!==displayName&&!avatars?.validNick(payload.nickname)){status.textContent=t('Bruk 2–24 tegn: bokstaver, tall, punktum, bindestrek eller understrek.');return}
  const mode=form.elements.display_mode.value;if(mode!=='nick'&&!payload.full_name){status.textContent=t('Fyll inn fullt navn for å bruke dette visningsvalget.');return}
  if(!own&&staff&&!w.confirm(t('Lagre endringer på denne spillerens profil?')))return;
  save.disabled=true;status.textContent=t('Lagrer…');
  try{const {data,error}=await client.rpc('save_player_presentation',{...Object.fromEntries(Object.entries(payload).map(([k,v])=>['p_'+k,v])),p_user_id:uid,p_display_mode:mode});if(error)throw error;const old=displayName;displayName=data||displayName;record=payload;displayMode=mode;w.DartArenaProfileLink?.invalidate(uid);if(old!==displayName){changedAt=new Date().toISOString();$('playerName').textContent=displayName;d.title='DartArena • '+displayName}render();dialog.close();$('playerDetailsStatus').textContent=t('Profil lagret.')}
  catch(e){status.textContent=t(e?.code==='23505'?'Kallenavnet er allerede i bruk.':String(e?.message).includes('nickname_cooldown')?'Du kan endre kallenavn én gang hver 14. dag.':'Kunne ikke lagre profilen. Prøv igjen.')}finally{save.disabled=false}
 });
 async function load(){
  const {data:{session}}=await client.auth.getSession();if(!session)return;
  own=session.user.id===uid;
  const [details,identity,admin]=await Promise.all([client.from('player_details').select('nickname,country,club,equipment,bio,full_name,display_mode').eq('user_id',uid).maybeSingle(),client.from('profiles').select('username,nickname_changed_at').eq('id',uid).maybeSingle(),client.rpc('is_admin')]);
  if(details.error||identity.error||!identity.data)throw details.error||identity.error||Error('profile_not_found');record=clean(details.data);displayMode=details.data?.display_mode||'nick';displayName=identity.data.username;changedAt=identity.data.nickname_changed_at;staff=admin.data===true;loaded=true;host.hidden=false;render();
 }
 const upload=$('avatarFile'),remove=$('removeAvatar'),avatarStatus=$('avatarStatus');
 upload.onchange=async()=>{const file=upload.files?.[0];if((!own&&!staff)||!file||!avatars)return;if(!own&&!w.confirm(t('Erstatte denne spillerens profilbilde?'))){upload.value='';return;}upload.disabled=true;remove.disabled=true;avatarStatus.textContent='';try{const blob=await w.DartArenaAvatarCrop.open(file);if(!blob)return;avatarStatus.textContent=t('Lagrer…');await avatars.uploadCropped(client,uid,blob);await drawAvatar();avatarStatus.textContent=t('Profilbilde lagret.')}catch{avatarStatus.textContent=t('Kunne ikke lagre profilbildet.')}finally{upload.value='';upload.disabled=false;remove.disabled=false}};
 remove.onclick=async()=>{if((!own&&!staff)||!avatars||!w.confirm(t('Fjerne profilbildet?')))return;remove.disabled=true;try{await avatars.remove(client,uid);await drawAvatar();avatarStatus.textContent=t('Profilbilde fjernet.')}catch{avatarStatus.textContent=t('Kunne ikke fjerne profilbildet.')}finally{remove.disabled=false}};
 load().catch(()=>{host.hidden=false;edit.hidden=true;$('playerDetailsStatus').textContent=t('Kunne ikke laste spilleropplysninger.')});
}
const api={clean,initial,boot};if(typeof module==='object'&&module.exports)module.exports=api;else boot(root);
})(typeof window!=='undefined'?window:globalThis);
