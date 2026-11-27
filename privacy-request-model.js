(function(root){
'use strict';
const types=['access','erasure','correction','other'],states=['received','reviewing','waiting','closed'];
const transitions={received:['reviewing'],reviewing:['waiting','closed'],waiting:['reviewing','closed'],closed:[]};
function add(items,type,now){
 if(!types.includes(type)||!Number.isFinite(now))throw Error('invalid_request');
 if(items.some(r=>r.type===type&&r.status!=='closed'))throw Error('duplicate_open');
 const id='TEST-'+String(items.length+1).padStart(3,'0');
 return [...items,{id,type,status:'received',createdAt:now,updatedAt:now,history:[{status:'received',at:now}]}];
}
function change(items,id,status,now){
 const item=items.find(r=>r.id===id);
 if(!item||!transitions[item.status]?.includes(status)||!Number.isFinite(now)||now<item.updatedAt)throw Error('invalid_transition');
 return items.map(r=>r.id===id?{...r,status,updatedAt:now,history:[...r.history,{status,at:now}]}:r);
}
const api=Object.freeze({types:Object.freeze(types),states:Object.freeze(states),next:status=>[...(transitions[status]||[])],add,change});
if(typeof module==='object'&&module.exports)module.exports=api;else root.DartArenaPrivacyPreview=api;
})(typeof window!=='undefined'?window:globalThis);
