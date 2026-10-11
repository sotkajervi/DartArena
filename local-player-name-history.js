/* DartArena local matches: shared browser-only player-name suggestions.
   No account/profile/online names are collected or transmitted. */
(function(){
  'use strict';
  const KEY='dartarena-local-player-name-history-v1';
  const LIST_ID='dartarena-local-player-name-suggestions';
  const MAX_NAMES=80;
  const normalize=value=>String(value??'').trim().replace(/\s+/g,' ').slice(0,32);
  const key=value=>value.toLocaleLowerCase('nb');
  function read(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||'[]');
      if(!Array.isArray(value))return [];
      const names=[],seen=new Set();
      for(const item of value){
        if(typeof item!=='string')continue;
        const name=normalize(item);
        if(name.length<2||seen.has(key(name)))continue;
        seen.add(key(name));names.push(name);
        if(names.length>=MAX_NAMES)break;
      }
      return names;
    }catch{return []}
  }
  function list(){
    let element=document.getElementById(LIST_ID);
    if(element)return element;
    element=document.createElement('datalist');
    element.id=LIST_ID;
    document.body.appendChild(element);
    return element;
  }
  function refresh(){
    const names=read().sort((a,b)=>a.localeCompare(b,'nb',{sensitivity:'base'}));
    const element=list();element.replaceChildren();
    for(const name of names){
      const option=document.createElement('option');
      option.value=name;
      element.appendChild(option);
    }
  }
  function remember(items){
    const entries=Array.isArray(items)?items:[items];
    const old=read(),seen=new Set();
    const names=[];
    for(const raw of [...entries,...old]){
      if(typeof raw!=='string')continue;
      const name=normalize(raw);
      if(name.length<2||seen.has(key(name)))continue;
      names.push(name);seen.add(key(name));
      if(names.length>=MAX_NAMES)break;
    }
    try{localStorage.setItem(KEY,JSON.stringify(names))}catch{}
    refresh();
  }
  function attach(ids){
    refresh();
    for(const id of ids){
      const input=document.getElementById(id);
      if(!input||input.tagName!=='INPUT')continue;
      input.setAttribute('list',LIST_ID);
      input.setAttribute('autocomplete','off');
      input.addEventListener('change',()=>remember(input.value));
    }
  }
  window.addEventListener('storage',event=>{if(event.key===KEY)refresh()});
  window.DartArenaLocalNameHistory={attach,remember,refresh};
})();
