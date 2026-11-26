(()=>{
'use strict';
const w=window,d=document,button=d.getElementById('daAdminCenterBtn'),panel=d.getElementById('daAdminCenterContent'),status=d.getElementById('daAdminCenterStatus');
if((!button&&!panel)||!w.supabase)return;
const db=w.DartArenaSupabaseClient||(w.DartArenaSupabaseClient=w.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'));
let serial=0;
const tr=(no,en)=>w.DartArenaI18n?.getLanguage()==='en'?en:no;
function hide(){if(button)button.hidden=true;if(panel)panel.hidden=true;}
async function refresh(){
 const token=++serial;hide();
 try{
  const {data,error}=await db.auth.getSession();if(token!==serial)return;
  if(error||!data?.session?.user){if(status)status.textContent=tr('Logg inn som administrator for å fortsette.','Sign in as an administrator to continue.');return;}
  const [a,o]=await Promise.all([db.rpc('is_admin'),db.rpc('is_owner')]);if(token!==serial)return;
  if(a.error||o.error||(!a.data&&!o.data)){if(status)status.textContent=tr('Tilgang krever Admin eller Owner.','Admin or Owner access is required.');return;}
  if(button)button.hidden=false;
  if(panel)panel.hidden=false;
  if(status)status.textContent='';
 }catch{if(token===serial&&status)status.textContent=tr('Kunne ikke kontrollere tilgang.','Unable to verify access.');}
}
if(button)button.onclick=()=>{w.location.href='admin-center.html'};
w.addEventListener('dartarena:lobby-entered',refresh);
w.addEventListener('dartarena:lobby-ready',refresh);
w.addEventListener('dartarena:lobby-left',()=>{serial++;hide()});
db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){serial++;hide();if(panel)w.location.replace('index.html');}else setTimeout(refresh,0)});
d.addEventListener('dartarena:languagechange',refresh);
refresh();
})();