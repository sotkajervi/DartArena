/* Keep the official group standings available through the cup phase.
 * Group ranks are computed by tournament.js from group-stage fixtures only.
 * This module changes page placement; it never recalculates rankings. */
(function(root){
  'use strict';
  function show(t){
    return t?.tournament_type==='groups_cup'&&
      ['groups','cup_setup','cup','finished'].includes(t.status);
  }
  function placement(t){
    if(!show(t))return null;
    if(t.status==='cup_setup')return 'after-setup';
    if(t.status==='cup'||t.status==='finished')return 'after-cup';
    return 'before-setup';
  }
  function sync(t,doc=root.document){
    const group=doc?.getElementById('groupLobby');
    const setup=doc?.getElementById('cupSetup');
    const cup=doc?.getElementById('cupLobby');
    if(!group||!setup||!cup)return;
    const mode=placement(t);
    group.classList.toggle('hidden',!mode);
    if(!mode)return;
    if(mode==='before-setup'){
      if(group.nextElementSibling!==setup)setup.parentNode?.insertBefore(group,setup);
    }else{
      const anchor=mode==='after-cup'?cup:setup;
      if(anchor.nextElementSibling!==group)anchor.insertAdjacentElement('afterend',group);
    }
  }
  const api=Object.freeze({show,placement,sync});
  root.DartArenaGroupResultsLayout=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
