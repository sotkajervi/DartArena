(function(w){
'use strict';
const d=w.document,button=d.getElementById('blockPlayerBtn'),manage=d.getElementById('managePlayerBlocksBtn'),status=d.getElementById('playerBlockStatus'),client=w.DartArenaSupabaseClient;
const target=new URLSearchParams(w.location.search).get('id');
const valid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
if(!button||!manage||!status||!client||!valid(target))return;
const t=s=>w.DartArenaI18n?.t?.(s)||s;
const el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n};
let blocked=false;
function label(){button.textContent=t(blocked?'Fjern blokkering':'Blokker utfordringer');button.setAttribute('aria-pressed',String(blocked))}
async function write(id,value){const {data,error}=await client.rpc('set_player_block',{p_target_id:id,p_blocked:value});if(error||data!==value)throw error||Error('write failed');return data}
button.onclick=async()=>{if(button.disabled)return;const next=!blocked;if(next&&!w.confirm(t('Vil du blokkere direkte utfordringer mellom deg og denne spilleren? Turneringskamper påvirkes ikke.')))return;
 button.disabled=true;status.textContent='';try{blocked=await write(target,next);label();status.textContent=t(blocked?'Direkte utfordringer er blokkert.':'Blokkering fjernet.')}catch{status.textContent=t('Kunne ikke endre blokkering. Prøv igjen.')}finally{button.disabled=false}};
manage.onclick=async()=>{if(d.getElementById('daBlockedPlayersDialog'))return;const x=el('dialog');x.id='daBlockedPlayersDialog';x.className='da-profile-dialog';const heading=el('h2',t('Blokkerte spillere')),hint=el('p',t('Direkte utfordringer blokkeres begge veier. Turneringskamper og allerede åpne venterom påvirkes ikke.')),list=el('div'),msg=el('p'),close=el('button',t('Lukk'));msg.setAttribute('role','status');close.type='button';close.onclick=()=>x.close();x.append(heading,hint,list,msg,close);x.addEventListener('close',()=>x.remove());d.body.append(x);x.showModal();
 try{const {data,error}=await client.from('player_blocks').select('blocked_id,created_at').order('created_at',{ascending:false});if(error)throw error;
  const ids=(data||[]).map(r=>r.blocked_id).filter(valid),names=new Map();
  for(let i=0;i<ids.length;i+=60){const {data:people,error:peopleError}=await client.from('profiles').select('id,username').in('id',ids.slice(i,i+60));if(!peopleError)for(const p of people||[])names.set(p.id,p.username)}
  function empty(){if(!list.children.length)list.append(el('p',t('Ingen blokkerte spillere.')))}
  for(const id of ids){const row=el('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #285057';const a=el('a',names.get(id)||id);a.href='player.html?id='+encodeURIComponent(id);a.setAttribute('data-no-i18n','');const un=el('button',t('Fjern blokkering'));un.type='button';un.className='outline';un.onclick=async()=>{un.disabled=true;try{await write(id,false);row.remove();empty();msg.textContent=t('Blokkering fjernet.')}catch{msg.textContent=t('Kunne ikke endre blokkering. Prøv igjen.');un.disabled=false}};row.append(a,un);list.append(row)}empty();
 }catch{msg.textContent=t('Kunne ikke laste blokkerte spillere.')}}
async function load(){const {data:{session}}=await client.auth.getSession();if(!session)return;if(session.user.id===target){manage.hidden=false;return}
 const [profile,block]=await Promise.all([client.from('profiles').select('id').eq('id',target).maybeSingle(),client.from('player_blocks').select('blocked_id').eq('blocked_id',target).maybeSingle()]);if(profile.error||!profile.data||block.error)return;blocked=!!block.data;label();button.hidden=false;
}
load().catch(()=>{});
})(window);
