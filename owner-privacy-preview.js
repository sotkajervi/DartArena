(()=>{
'use strict';
const $=id=>document.getElementById(id),room=$('privacyRoom'),access=$('privacyAccess'),M=window.DartArenaPrivacyPreview;
let authorized=false,ticket=0,rows=[],lang='no',message='';
try{lang=localStorage.getItem('dartarena-language')==='en'?'en':'no'}catch{}
const tr=(no,en)=>lang==='en'?en:no;
const labels={access:['Innsyn','Access'],erasure:['Sletting','Erasure'],correction:['Retting','Correction'],other:['Andre rettigheter','Other rights'],received:['Mottatt','Received'],reviewing:['Under behandling','Under review'],waiting:['Avventer avklaring','Awaiting clarification'],closed:['Avsluttet – test','Closed – test']};
const label=k=>tr(...labels[k]);
const set=(id,no,en)=>{$(id).textContent=tr(no,en)};
const el=(tag,txt)=>{const e=document.createElement(tag);e.textContent=txt;return e};
function deny(no,en){authorized=false;rows=[];message='';room.hidden=true;room.inert=true;access.hidden=false;access.textContent=tr(no,en);$('privacyQueue').replaceChildren();$('privacyMessage').textContent='';}
function render(){
 if(!authorized)return;
 document.documentElement.lang=lang;
 set('privacyTitle','Personvernpanel','Privacy request panel');set('privacyBack','Til Admin Center','Back to Admin Center');
 set('privacyNotice','Simulering med fiktive opplysninger. Ingen forespørsel sendes eller lagres, og ingen konto slettes.','Simulation with fictional data. No request is sent or stored and no account is deleted.');
 set('privacyCreateTitle','Simuler spillerens forespørsel','Simulate a player request');set('privacyTypeLabel','Forespørselstype','Request type');set('privacyAdd','Opprett testforespørsel','Create test request');set('privacyQueueTitle','Forespørsler til behandling','Request queue');set('privacyFilterLabel','Vis','Show');set('privacyReset','Nullstill simulering','Reset simulation');
 for(const o of $('privacyType').options)o.textContent=label(o.value);
 const filter=$('privacyFilter');for(const o of filter.options)o.textContent=({all:tr('Alle','All'),open:tr('Åpne','Open'),closed:tr('Avsluttede','Closed')})[o.value];
 $('privacyNo').setAttribute('aria-pressed',String(lang==='no'));$('privacyEn').setAttribute('aria-pressed',String(lang==='en'));
 $('privacyMessage').textContent=message==='duplicate'?tr('Det finnes allerede en åpen testforespørsel av denne typen.','An open test request of this type already exists.'):message==='created'?tr('Testforespørsel opprettet i minnet.','Test request created in memory.'):'';
 const list=$('privacyQueue');list.replaceChildren();const visible=rows.filter(r=>filter.value==='all'||(filter.value==='closed')===(r.status==='closed'));
 if(!visible.length)list.append(el('p',tr('Ingen testforespørsler.','No test requests.')));
 for(const r of visible){
  const card=el('article','');card.className='request';card.dataset.requestId=r.id;
  card.append(el('h3',r.id+' • '+label(r.type)),el('p',tr('Fiktiv spiller','Fictional player')+' • '+label(r.status)));
  if(r.type==='erasure')card.append(el('p',tr('Sletting ikke tilgjengelig. Ingen kontodata endres.','Erasure unavailable. No account data is changed.')));
  const trail=el('p',tr('Statushistorikk: ','Status history: ')+r.history.map(h=>label(h.status)).join(' → '));trail.className='muted';card.append(trail);
  const actions=el('div','');actions.className='actions';for(const next of M.next(r.status)){const b=el('button',label(next));b.type='button';b.className='outline';b.addEventListener('click',()=>{if(!authorized)return;try{rows=M.change(rows,r.id,next,Math.max(Date.now(),r.updatedAt));message='';render()}catch{}});actions.append(b)}card.append(actions);list.append(card);
 }
}
$('privacyForm').addEventListener('submit',e=>{e.preventDefault();if(!authorized)return;try{rows=M.add(rows,$('privacyType').value,Date.now());message='created'}catch{message='duplicate'}render()});
$('privacyReset').addEventListener('click',()=>{if(!authorized)return;rows=[];message='';render()});
$('privacyFilter').addEventListener('change',render);
for(const [id,l] of [['privacyNo','no'],['privacyEn','en']])$(id).addEventListener('click',()=>{if(!authorized)return;lang=l;render()});
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
async function check(){
 const t=++ticket;
 try{const {data,error}=await db.auth.getUser();if(t!==ticket)return;if(error||!data?.user)return deny('Logg inn med Owner-kontoen.','Sign in with an Owner account.');
 const role=await db.rpc('is_owner');if(t!==ticket)return;if(role.error||role.data!==true)return deny('Tilgang krever Owner.','Owner access required.');
 authorized=true;room.hidden=false;room.inert=false;access.hidden=true;render();
 }catch{if(t===ticket)deny('Kunne ikke kontrollere tilgang.','Unable to verify access.')}
}
if(db&&M){db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='SIGNED_IN'){ticket++;deny('Kontrollerer Owner-tilgang …','Checking Owner access …');if(event!=='SIGNED_OUT')setTimeout(check,0)}});check()}else deny('Kunne ikke laste testen.','Could not load the preview.');
})();