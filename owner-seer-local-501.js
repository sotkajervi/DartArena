(()=>{'use strict';
const $=id=>document.getElementById(id),access=$('seerLocalAccess'),room=$('seerLocalRoom');
const db = window.supabase?.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',
  );
let ticket=0,loaded=false,ownerId=null,initializing=false;
function deny(message){room.hidden=true;room.inert=true;$('localCheckout').inert=true;$('localCorrectionModal').inert=true;access.hidden=false;access.textContent=message;}
async function check(){
 const checkId=++ticket;
 try{
  const user=await db.auth.getUser();
  if(checkId!==ticket)return;
  if(user.error||!user.data?.user)return deny('Logg inn med Owner-kontoen.');
  const role=await db.rpc('is_owner');
  if(checkId!==ticket)return;
  if(role.error||role.data!==true)return deny('Tilgang krever Owner.');
  if(loaded&&ownerId!==user.data.user.id){location.reload();return;}
  if(!loaded&&!initializing){
   initializing=true;
   ownerId=user.data.user.id;
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='./local-h2h.js?v=20261127-seersim1';script.onload=resolve;script.onerror=reject;document.body.append(script);
   });
   loaded=true;initializing=false;
  }
  if(checkId!==ticket||!loaded)return;
  room.hidden=false;room.inert=false;$('localCheckout').inert=false;$('localCorrectionModal').inert=false;access.hidden=true;
 }catch{initializing=false;if(checkId===ticket)deny('Kunne ikke kontrollere Owner-tilgang eller laste kamprommet.');}
}
if(db){
 db.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='SIGNED_IN'&&loaded){
   ticket++;deny('Kontrollerer Owner-tilgang …');
   if(event!=='SIGNED_OUT')setTimeout(()=>location.reload(),0);
  }
 });
 check();
}else deny('Kunne ikke laste innlogging.');
})();