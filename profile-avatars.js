(function(w){
'use strict';
const BUCKET='player-avatars',MAX=102400,TTL=240000,cache=new Map(),pending=new Map();
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||''));
const validNick=n=>typeof n==='string'&&/^[\p{L}\p{N}][\p{L}\p{N}_.-]{1,23}$/u.test(n)&&!['admin','owner','moderator','dartarena','support','system','administrator'].includes(n.toLowerCase());
const path=id=>id+'/avatar.jpg';
function invalidate(id){cache.delete(id)}
async function getUrls(db,ids){
 ids=[...new Set(ids.filter(validId))];const missing=ids.filter(id=>!pending.has(id)&&(!cache.has(id)||Date.now()-cache.get(id).at>TTL));
 if(missing.length){
 const job=(async()=>{try{
  const {data,error}=await db.from('player_avatars').select('user_id,updated_at').in('user_id',missing);if(error)throw error;
  const present=new Set((data||[]).map(r=>r.user_id));
  for(const id of missing)cache.set(id,{at:Date.now(),url:null});
  if(present.size){const {data:urls,error:signError}=await db.storage.from(BUCKET).createSignedUrls([...present].map(path),300);if(signError)throw signError;
   for(const r of urls||[]){const id=String(r.path||'').split('/')[0];if(present.has(id)&&r.signedUrl)cache.set(id,{at:Date.now(),url:r.signedUrl})}}
 }catch{for(const id of missing)cache.set(id,{at:Date.now(),url:null})}finally{for(const id of missing)pending.delete(id)}})();
 for(const id of missing)pending.set(id,job);
 }
 await Promise.all([...new Set(ids.map(id=>pending.get(id)).filter(Boolean))]);return new Map(ids.map(id=>[id,cache.get(id)?.url||null]));
}
async function paint(db,host){
 if(!host||!db)return;
 const nodes=[...(host.matches?.('[data-avatar-id]')?[host]:[]),...host.querySelectorAll('[data-avatar-id]')];
 const urls=await getUrls(db,nodes.map(n=>n.dataset.avatarId));
 for(const n of nodes){if(!n.isConnected)continue;const url=urls.get(n.dataset.avatarId);const old=n.querySelector('img[data-player-avatar]');if(!url){old?.remove();continue}if(old?.getAttribute('src')===url)continue;old?.remove();const img=w.document.createElement('img');img.dataset.playerAvatar='1';img.alt='';img.decoding='async';img.loading='lazy';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';img.onerror=()=>img.remove();img.src=url;n.style.position='relative';img.style.position='absolute';img.style.inset='0';n.append(img)}
}
async function encodeCanvas(c){
 for(const q of [.86,.72,.58,.44,.3]){const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',q));if(blob&&blob.type==='image/jpeg'&&blob.size<=MAX)return blob}throw Error('invalid_avatar');
}
async function compress(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('invalid_avatar');
 const image=await w.createImageBitmap(file);try{const c=w.document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const side=Math.min(image.width,image.height);ctx.fillStyle='#0b1719';ctx.fillRect(0,0,256,256);ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);return await encodeCanvas(c)}finally{image.close()}
}
async function upload(db,id,file){return uploadCropped(db,id,await compress(file))}
async function uploadCropped(db,id,blob){if(!validId(id)||!blob||blob.type!=='image/jpeg'||blob.size>MAX||!blob.size)throw Error('invalid_avatar');const {error}=await db.storage.from(BUCKET).upload(path(id),blob,{contentType:'image/jpeg',upsert:true,cacheControl:'300'});if(error)throw error;const {error:meta}=await db.from('player_avatars').upsert({user_id:id,updated_at:new Date().toISOString()});if(meta)throw meta;invalidate(id)}
async function remove(db,id){if(!validId(id))throw Error('invalid_avatar');const {error}=await db.storage.from(BUCKET).remove([path(id)]);if(error)throw error;const {error:meta}=await db.from('player_avatars').delete().eq('user_id',id);if(meta)throw meta;invalidate(id)}
const api={validNick,validId,paint,getUrls,compress,encodeCanvas,upload,uploadCropped,remove,invalidate};if(typeof module==='object'&&module.exports)module.exports=api;else w.DartArenaIdentity=api;
})(typeof window!=='undefined'?window:globalThis);
