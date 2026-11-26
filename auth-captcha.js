(()=>{'use strict';
 const siteKey=String(window.DartArenaAuthCaptchaConfig?.siteKey||'').trim();
 const tr=(no,en)=>window.DartArenaI18n?.getLanguage?.()==='en'?en:no;
 const fail=()=>Object.assign(new Error('CAPTCHA verification failed'),{code:'da_captcha_failed'});
 let loading=null;
 function load(){
  if(window.turnstile?.render)return Promise.resolve(window.turnstile);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.referrerPolicy='no-referrer';
   const timer=setTimeout(()=>{script.remove();reject(fail())},15000);
   script.onload=()=>{clearTimeout(timer);window.turnstile?.render?resolve(window.turnstile):reject(fail())};
   script.onerror=()=>{clearTimeout(timer);script.remove();reject(fail())};
   document.head.append(script);
  }).catch(error=>{loading=null;throw error});
  return loading;
 }
 const active=new Set();
 async function token(formId){
  if(!siteKey)return undefined;
  if(active.has(formId))throw fail();
  const form=document.getElementById(formId);if(!form||form.hidden)throw fail();
  active.add(formId);
  let widget,host,api;
  try{
   api=await load();host=document.createElement('div');host.style.margin='12px 0';
   form.insertBefore(host,form.querySelector('[type="submit"]'));
   return await new Promise((resolve,reject)=>{
    let done=false;
    const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value)};
    const timer=setTimeout(()=>finish(null,fail()),120000);
    try{widget=api.render(host,{sitekey:siteKey,theme:'dark',size:'flexible',retry:'never','response-field':false,callback:value=>typeof value==='string'&&value?finish(value):finish(null,fail()),'error-callback':()=>finish(null,fail()),'expired-callback':()=>finish(null,fail()),'timeout-callback':()=>finish(null,fail()),'unsupported-callback':()=>finish(null,fail())})}catch(_){finish(null,fail())}
   });
  }finally{try{if(widget!=null)api.remove(widget)}catch(_){}host?.remove();active.delete(formId)}
 }
 function message(error){if(['da_captcha_failed','captcha_failed'].includes(error?.code))return tr('Sikkerhetskontrollen mislyktes. Prøv igjen.','Security verification failed. Please try again.');return undefined}
 window.DartArenaAuthCaptcha=Object.freeze({token,message,enabled:!!siteKey});
})();
