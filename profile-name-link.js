(function(root){
'use strict';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function html(id,name,classes=''){
 const label=escape(name),cls=escape(classes);
 if(!valid(id))return '<span class="'+cls+'" data-no-i18n>'+label+'</span>';
 return '<a class="'+cls+' da-profile-link" data-user-id="'+escape(id)+'" data-no-i18n href="player.html?id='+encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>';
}
const api={valid,html};if(typeof module==='object'&&module.exports)module.exports=api;else root.DartArenaProfileLink=api;
})(typeof window!=='undefined'?window:globalThis);
