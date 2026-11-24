/* Main lobby navigation and progressive enhancement. All data actions remain in existing modules. */
(()=>{
  'use strict';
  if(window.__daLobbyUx1)return;
  window.__daLobbyUx1=true;
  const $=id=>document.getElementById(id);
  const lobby=$('lobbyView');
  if(!lobby)return;

  // Native menu keeps existing Cam-test and logout button IDs and click handlers.
  const menu=$('daUtilityMenu');
  document.addEventListener('pointerdown',event=>{
    if(menu?.open&&!menu.contains(event.target))menu.open=false;
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary')?.focus();}
  });
  menu?.querySelectorAll('a,button').forEach(item=>item.addEventListener('click',()=>{
    menu.open=false;
  }));

  // Turn the dynamically rendered archive into a 3-row preview, preserving all controls.
  const archive=$('pastTournamentList'),toggle=$('daArchiveToggle');
  let archiveExpanded=false;
  function refreshArchive(){
    if(!archive||!toggle)return;
    const rows=[...archive.children].filter(row=>row.classList.contains('tournament-row'));
    rows.forEach((row,index)=>{
      row.classList.toggle('da-archive-hidden',!archiveExpanded&&index>=3);
      const actions=row.querySelector('.challenge-actions');
      if(!actions)return;
      const deleteButton=[...actions.children].find(el=>el.classList.contains('admin-delete-tournament'));
      if(deleteButton){
        let details=actions.querySelector('.da-archive-admin-menu');
        if(!details){
          details=document.createElement('details');
          details.className='da-archive-admin-menu';
          const summary=document.createElement('summary');
          summary.setAttribute('aria-label','Administrer turnering');
          summary.title='Adminhandlinger';
          summary.textContent='⋯';
          const popover=document.createElement('div');
          popover.className='da-archive-admin-popover';
          details.append(summary,popover);
          actions.appendChild(details);
        }
        details.querySelector('.da-archive-admin-popover').appendChild(deleteButton);
      }
      actions.querySelectorAll('.da-archive-admin-menu').forEach(details=>{
        if(!details.querySelector('.admin-delete-tournament'))details.remove();
      });
    });
    toggle.hidden=rows.length<=3;
    toggle.textContent=archiveExpanded?'Vis færre turneringer':`Se alle turneringer (${rows.length})`;
    toggle.setAttribute('aria-expanded',String(archiveExpanded));
  }
  if(archive&&toggle){
    toggle.addEventListener('click',()=>{
      archiveExpanded=!archiveExpanded;
      refreshArchive();
      if(!archiveExpanded)archive.closest('.tournament-section')?.scrollIntoView({block:'start',behavior:'auto'});
    });
    new MutationObserver(refreshArchive).observe(archive,{childList:true,subtree:true});
    refreshArchive();
  }

  // Chat is created asynchronously after login; enhance it once when it appears.
  function enhanceChat(){
    const card=$('dartArenaChat');
    if(!card||!lobby.contains(card)||card.dataset.daUxReady)return false;
    const heading=card.querySelector('.dart-chat-heading');
    const messages=card.querySelector('#dartChatMessages');
    if(!heading||!messages)return false;
    card.dataset.daUxReady='1';
    const button=document.createElement('button');
    button.type='button';
    button.className='small-btn da-chat-expand';
    button.setAttribute('aria-controls','dartChatMessages');
    let expanded=false;
    function updateButton(){
      card.classList.toggle('da-chat-expanded',expanded);
      button.textContent=expanded?'Minimer chat':'Utvid chat';
      button.setAttribute('aria-expanded',String(expanded));
    }
    button.addEventListener('click',()=>{expanded=!expanded;updateButton();});
    heading.appendChild(button);
    const updateEmpty=()=>{
      card.classList.toggle('da-chat-empty',!messages.querySelector('.dart-chat-message'));
    };
    new MutationObserver(updateEmpty).observe(messages,{childList:true,subtree:true});
    updateEmpty();updateButton();
    return true;
  }
  if(!enhanceChat()){
    const observer=new MutationObserver(()=>{if(enhanceChat())observer.disconnect();});
    observer.observe(lobby,{childList:true,subtree:true});
  }
})();
