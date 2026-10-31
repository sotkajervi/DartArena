// Owner-only global video switch. Database RLS is authoritative, not this UI.
(function(root){
  'use strict';
  if(!root.supabase||root.__daOwnerMediaSwitch)return;
  root.__daOwnerMediaSwitch=true;
  const URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const client=root.supabase.createClient(URL,KEY);
  let panel=null,initializing=false;
  function status(message,warning=false){
    const p=panel?.querySelector('[data-sfu-status]');
    if(p){p.textContent=message;p.style.color=warning?'#ffc078':'#b9d7d9'}
  }
  function render(mode){
    if(!panel)return;
    for(const button of panel.querySelectorAll('[data-media-mode]')){
      button.disabled=button.dataset.mediaMode===mode;
      button.setAttribute('aria-pressed',String(button.dataset.mediaMode===mode));
      button.style.borderColor=button.dataset.mediaMode===mode?'#00eaf4':'rgba(255,255,255,.18)';
    }
    status(mode==='sfu'?'Aktivt for NYE kamprom: Ny SFU':'Aktivt for NYE kamprom: Gammel video');
  }
  async function read(){
    const {data,error}=await client.from('media_transport_config').select('mode').eq('id',1).single();
    if(error)throw error;
    if(data?.mode!=='legacy'&&data?.mode!=='sfu')throw Error('Ukjent mediemodus');
    render(data.mode);
  }
  async function setMode(mode){
    if(!['legacy','sfu'].includes(mode)||!panel)return;
    // The toggle must never silently change transport inside an existing match:
    // both players need to reload the room after a switch.
    const message=mode==='sfu'
      ?'Aktivere NY SFU for nye kamprom? Spillere som allerede er i kamp blir ikke automatisk flyttet.'
      :'Slå tilbake til GAMMEL VIDEO for nye kamprom? Begge spillere i berørte rom må åpne kamprommet på nytt.';
    if(!root.confirm(message))return;
    for(const b of panel.querySelectorAll('button'))b.disabled=true;
    status('Lagrer endring…');
    try{
      const {data,error}=await client.from('media_transport_config')
        .update({mode,updated_at:new Date().toISOString()}).eq('id',1).select('mode').single();
      if(error||data?.mode!==mode)throw error||Error('Endringen ble ikke lagret');
      render(mode);
      status((mode==='legacy'?'Gammel video':'Ny SFU')+' er nå valgt for nye kamprom. Åpne rom på nytt for å bytte.');
    }catch(error){
      status('Kunne ikke endre videomodus: '+(error?.message||error),true);
      try{await read()}catch{}
    }
  }
  async function init(){
    if(panel||initializing)return;
    initializing=true;
    try{
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const {data:isOwner,error}=await client.rpc('is_owner');
    if(error||isOwner!==true)return;
    const host=document.querySelector('.lobby-utility-row')||document.querySelector('#daTournamentLobby');
    if(!host)return;
    panel=document.createElement('section');
    panel.id='ownerMediaSwitch';
    panel.className='card';
    panel.style.cssText='width:100%;max-width:590px;padding:14px 18px;margin:10px 0;border:1px solid rgba(0,234,244,.35)';
    panel.innerHTML='<small style="color:#00eaf4;font-weight:900">OWNER · VIDEOSYSTEM</small>'
      +'<h3 style="margin:5px 0 9px">Video for nye kamprom</h3>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<button type="button" class="outline" data-media-mode="legacy">Gammel video</button>'
      +'<button type="button" class="outline" data-media-mode="sfu">Ny SFU</button></div>'
      +'<p data-sfu-status role="status" style="font-size:12px;margin:10px 0 0">Henter aktivt videosystem…</p>'
      +'<p style="font-size:12px;color:#9ab4b7;margin:5px 0 0">Gjelder alle spillere ved neste åpning av kamprom. Under pågående kamp må begge åpne rommet på nytt ved bytte. Tilskuervideo er ikke klar i ny SFU.</p>';
    host.insertAdjacentElement('afterend',panel);
    for(const button of panel.querySelectorAll('[data-media-mode]')){
      button.addEventListener('click',()=>setMode(button.dataset.mediaMode));
      button.disabled=true;
    }
    try{await read()}catch(error){status('Kunne ikke lese global videomodus. Gammel video er trygg standard.',true)}
    const onVisible=()=>{if(document.visibilityState==='visible')read().catch(()=>{})};
    document.addEventListener('visibilitychange',onVisible);
    }finally{initializing=false}
  }
  client.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){
      panel?.remove();panel=null;
    }else if(event==='SIGNED_IN'||event==='INITIAL_SESSION'){
      setTimeout(()=>init().catch(error=>console.warn('[OWNER MEDIA]',error)),0);
    }
  });
  init().catch(error=>console.warn('[OWNER MEDIA]',error));
})(window);
