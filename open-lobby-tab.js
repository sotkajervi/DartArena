(()=>{
  const button=document.getElementById('openLobbyTabBtn');
  if(!button)return;
  button.addEventListener('click',()=>{
    // Called synchronously from a player click; keep the current room and media alive.
    // Match-room lobby buttons use this same reusable named tab.
    const tab=window.open('./','dartarena-lobby');
    if(!tab){
      alert('Nettleseren blokkerte lobbyfanen. Tillat popup-vinduer for DartArena.');
      return;
    }
    try{tab.opener=null;tab.focus()}catch{}
  });
})();
