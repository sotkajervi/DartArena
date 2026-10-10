/* Autoscoring Lab menu link – visible to Supabase Owner/Admin only.
   The lab itself repeats authorization before accessing the camera. */
(()=>{
  'use strict';
  const link=document.getElementById('autoscoringLabLink');
  if(!link||!window.supabase)return;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  let serial=0;
  const hide=()=>{link.hidden=true;link.style.display='none'};
  const refresh=async()=>{
    const ticket=++serial;
    hide();
    try{
      const {data,error}=await db.auth.getUser();
      if(ticket!==serial||error||!data?.user)return;
      const [admin,owner]=await Promise.all([db.rpc('is_admin'),db.rpc('is_owner')]);
      if(ticket!==serial)return;
      if(admin.error||owner.error)return;
      if(admin.data===true||owner.data===true){link.hidden=false;link.style.display=''}
    }catch(e){if(ticket===serial)hide()}
  };
  window.addEventListener('dartarena:lobby-entered',refresh);
  window.addEventListener('dartarena:lobby-ready',refresh);
  window.addEventListener('dartarena:lobby-left',()=>{serial++;hide()});
  db.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  hide();refresh();
})();