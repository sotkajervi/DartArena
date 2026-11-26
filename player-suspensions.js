(function(w){
'use strict';
const d=w.document,button=d.getElementById('suspendPlayerBtn'),client=w.DartArenaSupabaseClient,target=new URLSearchParams(w.location.search).get('id');
if(!button||!client||!target||!(/^[0-9a-f-]{36}$/i.test(target)))return;
const t=s=>w.DartArenaI18n?.t?.(s)||s;
const el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const fmt=s=>s?new Date(s).toLocaleString():t('Permanent');
async function load(){const {data}=await client.auth.getSession();if(!data?.session?.user||data.session.user.id===target)return;const [{data:staff,error},{data:p,error:pe}]=await Promise.all([client.rpc('is_admin'),client.from('profiles').select('id').eq('id',target).maybeSingle()]);if(error||!staff||pe||!p)return;button.hidden=false}
button.onclick=async()=>{if(d.getElementById('suspensionDialog'))return;
 const x=el('dialog');x.id='suspensionDialog';x.className='da-profile-dialog';x.setAttribute('data-no-i18n','');const head=el('h2',t('Suspensjon')),list=el('div'),form=el('form'),msg=el('p');msg.setAttribute('role','status');
 const reason=el('textarea');reason.required=true;reason.maxLength=1000;reason.rows=3;const rlabel=el('label',t('Begrunnelse'));rlabel.append(reason);
 const action=el('select');const alabel=el('label',t('Varighet'));alabel.append(action);const save=el('button',t('Suspender spiller'));save.type='submit';const close=el('button',t('Lukk'));close.type='button';close.onclick=()=>x.close();const buttons=el('div');buttons.className='da-profile-buttons';buttons.append(close,save);form.append(alabel,rlabel,buttons);x.append(head,msg,list,form);form.hidden=true;x.addEventListener('close',()=>x.remove());d.body.append(x);x.showModal();
 let busy=false; x.addEventListener('cancel',e=>{if(busy)e.preventDefault()}); 
 function confirmAction(revoke){
  return new Promise(resolve=>{
   const confirm=el('dialog');confirm.className='da-profile-dialog';confirm.setAttribute('data-no-i18n','');confirm.setAttribute('aria-labelledby','suspensionConfirmTitle');confirm.setAttribute('aria-describedby','suspensionConfirmMessage');
   const kicker=el('small','DARTARENA');kicker.style.color='#00eaf4';
   const title=el('h2',t(revoke?'Opphev suspensjon':'Suspender spiller'));title.id='suspensionConfirmTitle';
   const message=el('p',t(revoke?'Bekreft oppheving av suspensjon?':'Bekreft suspensjon av denne spilleren?'));message.id='suspensionConfirmMessage';
   const actions=el('div');actions.className='da-profile-buttons';const cancel=el('button',t('Avbryt')),accept=el('button',t('Bekreft'));cancel.type=accept.type='button';cancel.className='outline';accept.className=revoke?'primary':'danger';accept.style.cssText=revoke?'':'color:#ffd0d3;border-color:#b6525b;background:#57252b';
   actions.append(cancel,accept);confirm.append(kicker,title,message,actions);d.body.append(confirm);
   let approved=false;cancel.onclick=()=>confirm.close();accept.onclick=()=>{approved=true;confirm.close()};
   confirm.addEventListener('close',()=>{confirm.remove();resolve(approved)},{once:true});
   try{confirm.showModal();cancel.focus()}catch{confirm.remove();resolve(false)}
  });
 }
 async function refresh(){const {data,error}=await client.from('player_suspensions').select('id,imposed_at,ends_at,reason,revoked_at,revocation_reason').eq('player_id',target).order('imposed_at',{ascending:false}).limit(30);if(error)throw error;const rows=data||[],active=rows.find(r=>!r.revoked_at&&(!r.ends_at||Date.parse(r.ends_at)>Date.now()));
 list.replaceChildren(el('h3',t('Suspensjonshistorikk')));if(!rows.length)list.append(el('p',t('Ingen suspensjoner.')));
 for(const r of rows){const p=el('p');p.style.cssText='border-bottom:1px solid #285057;padding:8px 0;white-space:pre-wrap;overflow-wrap:anywhere';p.textContent=(r.revoked_at?t('Opphevet'):r===active?t('Aktiv suspensjon'):t('Utløpt'))+' · '+fmt(r.imposed_at)+' – '+fmt(r.ends_at)+'\n'+r.reason+(r.revocation_reason?'\n'+t('Opphevet')+': '+r.revocation_reason:'');list.append(p)}
 action.replaceChildren();for(const [v,l] of active?[['revoke','Opphev suspensjon']]:[['24h','24 timer'],['7d','7 dager'],['30d','30 dager'],['permanent','Permanent']]){const o=el('option',t(l));o.value=v;action.append(o)}save.textContent=t(active?'Opphev suspensjon':'Suspender spiller');form.hidden=false;
 }
 form.onsubmit=async e=>{e.preventDefault();if(busy||!reason.value.trim())return;busy=true;save.disabled=close.disabled=action.disabled=reason.disabled=true;msg.textContent='';try{if(!await confirmAction(action.value==='revoke'))return;const {error}=await client.rpc('manage_player_suspension',{p_player_id:target,p_action:action.value,p_reason:reason.value.trim()});if(error)throw error;reason.value='';msg.textContent=t('Suspensjon lagret.');w.dispatchEvent(new Event('dartarena:suspension-changed'));await refresh()}catch(e){msg.textContent=t(e?.message==='active_play'?'Kan ikke suspendere en spiller med aktiv kamp, venterom eller pågående turnering. Avklar dette først.':e?.message==='protected_player'?'Administratorkontoer er beskyttet.':'Kunne ikke lagre suspensjonen.')}finally{busy=false;save.disabled=close.disabled=action.disabled=reason.disabled=false}};
 try{await refresh()}catch{msg.textContent=t('Kunne ikke laste suspensjoner.');form.hidden=true}
};
load().catch(()=>{});
})(window);
