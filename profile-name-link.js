(function(root){
'use strict';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function html(id,name,classes=''){
 const label=escape(name),cls=escape(classes);
 if(!valid(id))return '<span class="'+cls+'" data-no-i18n>'+label+'</span>';
 return '<a class="'+cls+' da-profile-link" data-user-id="'+escape(id)+'" data-no-i18n href="player.html?id='+encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>';
}
// Resolve presentation only at render time. No new polling or changes to match data.
const names=new Map(),inflight=new Map(),TTL=120000;
function display(nick,full,mode){nick=String(nick||'').trim();full=String(full||'').trim();if(!full||mode==='nick')return nick;if(mode==='full')return full;if(mode==='both')return full===nick?full:full+' «'+nick+'»';return nick}
function invalidate(id){names.delete(id)}
async function fetchNames(db,ids){
 const missing=[...new Set(ids.filter(valid))].filter(id=>!inflight.has(id)&&(!names.has(id)||Date.now()-names.get(id).at>TTL));
 for(let start=0;start<missing.length;start+=60){
  const batch=missing.slice(start,start+60);const job=(async()=>{try{
   const {data,error}=await db.from('player_details').select('user_id,full_name,display_mode').in('user_id',batch);
   if(error)throw error;
   const rows=new Map((data||[]).map(r=>[r.user_id,r]));
   for(const id of batch)names.set(id,{at:Date.now(),row:rows.get(id)||null});
  }catch{for(const id of batch)names.set(id,{at:Date.now()-TTL+15000,row:null})}finally{for(const id of batch)inflight.delete(id)}})();
  batch.forEach(id=>inflight.set(id,job));
 }
 await Promise.all([...new Set(ids.map(id=>inflight.get(id)).filter(Boolean))]);
}
async function resolve(db,players,{fresh=false}={}){
 const ids=players.map(p=>p.id).filter(valid);
 if(fresh)ids.forEach(invalidate);
 if(db)await fetchNames(db,ids);
 return Object.fromEntries(players.map(p=>{const row=names.get(p.id)?.row;return [p.id,display(p.username,row?.full_name,row?.display_mode)]}));
}
async function paint(db,host,options={}){
 if(!db||!host)return;
 const nodes=[...host.querySelectorAll('a.da-profile-link[data-user-id],[data-da-display-id]')];if(!nodes.length)return;
 const ids=nodes.map(n=>n.dataset.daDisplayId||n.dataset.userId);
 await fetchNames(db,ids);
 for(const n of nodes){if(!n.isConnected)continue;const id=n.dataset.daDisplayId||n.dataset.userId;if(!valid(id))continue;
  if(!n.dataset.daOriginalName)n.dataset.daOriginalName=n.textContent.trim();
  const row=names.get(id)?.row,shown=display(n.dataset.daOriginalName,row?.full_name,row?.display_mode);
  let label=n.querySelector(':scope > .da-display-label');if(!label){label=root.document.createElement('span');label.className='da-display-label';n.replaceChildren(label)}
  label.textContent=shown;
  n.dataset.userId=id;n.setAttribute('data-no-i18n','');
  if(options.avatars!==false&&!n.matches('.winner-name,.set-winner,.premium-leg-winner')&&!n.querySelector(':scope > .da-inline-avatar')){
   const av=root.document.createElement('span');av.className='da-inline-avatar';av.dataset.avatarId=id;av.dataset.initial=Array.from(shown||'?')[0]?.toUpperCase()||'?';av.setAttribute('aria-hidden','true');n.prepend(av);n.classList.add('da-with-avatar');
  }
 }
 await root.DartArenaIdentity?.paint(db,host);
 root.DartArenaRoleVisuals?.scan?.(host);
}
const api={valid,html,display,paint,invalidate,resolve};if(typeof module==='object'&&module.exports)module.exports=api;else root.DartArenaProfileLink=api;
})(typeof window!=='undefined'?window:globalThis);
