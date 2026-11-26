/* DartArena Issue Center v1. No media transport changes or background uploads. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  if(root.DartArenaIssueCenter)return;
  root.DartArenaIssueCenter=api;
  api.boot(root);
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const VERSION='issue-center-v1-20261125';
  const categories=['video','audio','scoring','tournament','performance','other','suggestion'];
  const eventTypes=['STATE','HEARTBEAT','MARK','CONSOLE_WARN','CONSOLE_ERROR','CONSOLE_DEBUG','SCRIPT_ERROR','UNHANDLED_REJECTION','TRACE_ERROR'];
  const states=['new','connecting','connected','disconnected','failed','closed','checking','completed','stable','have-local-offer','have-remote-offer','have-local-pranswer','have-remote-pranswer'];
  const modes=['p2p','sfu','direct','webrtc','cloudflare','legacy','secure-sfu','sfu-secure',''];
  const marks=['TRACE_STARTED','PAGE_HIDE','PAGE_SHOW','VISIBILITY','LOG_EXPORTED'];
  const asEnum=(v,a)=>a.includes(v)?v:null;
  const bool=v=>typeof v==='boolean'?v:null;
  const num=(v,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
  const pageName=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}\.html$/.test(v)?v:'index.html';
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)?v:null;
  const iso=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)?v:null;
  const track=v=>v&&typeof v==='object'?{kind:asEnum(v.kind,['video','audio']),state:asEnum(v.state,['live','ended']),muted:bool(v.muted),enabled:bool(v.enabled)}:null;
  const tracks=v=>Array.isArray(v)?v.slice(0,4).map(track).filter(Boolean):null;
  const peer=v=>v&&typeof v==='object'?{connection:asEnum(v.connection,states),ice:asEnum(v.ice,states),signaling:asEnum(v.signaling,states)}:null;
  const video=v=>v&&typeof v==='object'?{stream:tracks(v.stream),paused:bool(v.paused),muted:bool(v.muted),ready:num(v.ready,4),size:Array.isArray(v.size)?v.size.slice(0,2).map(n=>num(n,16384)):null}:null;
  const room=v=>v&&typeof v==='object'?{ready:bool(v.ready),capture:tracks(v.capture),publication:bool(v.publication),peer:peer(v.peer),sfuReady:bool(v.sfuReady)}:null;
  function sanitizeEvent(e){
    if(!e||!eventTypes.includes(e.type))return null;
    const d=e.data&&typeof e.data==='object'?e.data:{};
    const out={type:e.type,time:iso(e.time),ms:num(e.ms)};
    if(e.type==='STATE')out.data={page:pageName(d.page),scene:bool(d.scene),mode:asEnum(d.mode,modes),online:bool(d.online),visible:bool(d.visible),local:video(d.local),remote:video(d.remote),tournamentRoom:room(d.tournamentRoom),challengeRoom:room(d.challengeRoom),match:room(d.match)};
    else if(e.type==='HEARTBEAT')out.data={page:pageName(d.page),scene:bool(d.scene),mode:asEnum(d.mode,modes),remote:tracks(d.remote),match:bool(d.match)};
    else if(e.type==='MARK')out.data={label:asEnum(d.label,marks)||'OTHER_MARK'};
    else if(e.type==='SCRIPT_ERROR')out.data={line:num(d.line,1000000)};
    else if(e.type.startsWith('CONSOLE_')){
      const m=typeof d.message==='string'?d.message:'';
      out.data={area:['SFU','WEBRTC','HANDOFF','MEDIA','TOURNAMENT','ROOM','NETWORK','PUBLISH','SUBSCRI'].find(x=>m.toUpperCase().includes(x))||'OTHER'};
    }
    return out;
  }
  function browserInfo(ua){
    const s=String(ua||'');const m=s.match(/(?:Edg|OPR|Firefox|Chrome|Version)\/\d+/);
    return {browser:m?m[0]:'Other',os:/Android/.test(s)?'Android':/iPhone|iPad/.test(s)?'iOS':/Windows/.test(s)?'Windows':/Macintosh/.test(s)?'macOS':/Linux/.test(s)?'Linux':'Other'};
  }
  function diagnostics(raw,ua,live,errors=[]){
    let parsed;try{parsed=JSON.parse(raw||'null')}catch{}
    const events=Array.isArray(parsed?.events)?parsed.events.slice(-120).map(sanitizeEvent).filter(Boolean):[];
    const out={version:VERSION,browser:browserInfo(ua),mediaTraceAvailable:events.length>0,events,current:live?sanitizeEvent({type:'STATE',data:live}):null,errors:errors.slice(-20).map(sanitizeEvent).filter(Boolean)};
    while(JSON.stringify(out).length>40000&&out.events.length)out.events.shift();
    return out;
  }
  function contextFor(loc,doc){
    const p=new URLSearchParams(loc.search||'');
    const page=pageName(loc.pathname.split('/').pop());
    const versions=[];
    for(const el of doc.querySelectorAll('script[src]')){
      try{const u=new URL(el.getAttribute('src'),loc.href);const v=u.searchParams.get('v');if(u.origin===loc.origin&&v&&/^[a-zA-Z0-9_-]{1,50}$/.test(v)&&!versions.includes(v))versions.push(v)}catch{}
      if(versions.length>=16)break;
    }
    return {page,context:{version:VERSION,match_id:uuid(p.get('matchId')||p.get('id')),tournament_id:uuid(p.get('tournamentId')||p.get('tournament')),tournament_match_id:uuid(p.get('tournamentMatch')),mode:asEnum(p.get('mode'),['standard','dartcounter','online','local','501','301','170','cricket']),versions}};
  }
  function boot(w){
    const d=w.document;if(!d?.body)return;
    const errors=[];
    const push=e=>{errors.push(e);if(errors.length>20)errors.shift()};
    w.addEventListener('error',e=>push({type:'SCRIPT_ERROR',time:new Date().toISOString(),data:{line:e.lineno}}));
    w.addEventListener('unhandledrejection',()=>push({type:'UNHANDLED_REJECTION',time:new Date().toISOString()}));
    const en=()=>{try{return w.localStorage.getItem('dartarena-language')==='en'}catch{return false}};
    const tr=(no,eng)=>en()?eng:no;
    const titles={video:['Video / kamera','Video / camera'],audio:['Lyd','Audio'],scoring:['Poengføring','Scoring'],tournament:['Turnering','Tournament'],performance:['Forsinkelse / ytelse','Lag / performance'],other:['Annet','Other'],suggestion:['Funksjonsforslag','Feature suggestion']};
    const playerTitles={name:['Upassende navn / kallenavn','Inappropriate name / nickname'],avatar:['Upassende profilbilde','Inappropriate profile picture'],behavior:['Dårlig oppførsel / trakassering','Misconduct / harassment'],cheating:['Mistanke om juks','Suspected cheating'],no_show:['Uteblivelse fra turneringskamp','Tournament no-show'],spam:['Spam / uønskede utfordringer','Spam / unwanted challenges'],other:['Annet','Other']};
    const playerStates=[['new','Ny','New'],['investigating','Undersøkes','Investigating'],['dismissed','Avvist','Dismissed'],['resolved','Behandlet','Resolved']];
    const el=(tag,text,cls)=>{const x=d.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
    const btn=(text,fn,cls='da-issue-button')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b};
    const client=()=>{try{if(w.DartArenaSupabaseClient)return w.DartArenaSupabaseClient;if(typeof db!=='undefined'&&db)return db}catch{}return w.supabase?(w.DartArenaSupabaseClient=w.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK')):null};
    const style=el('style');
    style.textContent='.da-issue-launch{position:fixed;right:10px;bottom:10px;z-index:1000;font:600 12px system-ui;opacity:.9}.da-issue-button,.da-issue-dialog button{border:1px solid #287982;border-radius:8px;background:#102b30;color:#eaffff;padding:8px 12px;cursor:pointer;font:inherit}.da-issue-dialog{box-sizing:border-box;background:#0c1b20;color:#eaffff;border:1px solid #27858d;border-radius:14px;width:min(580px,94vw);max-height:88vh;overflow:auto;padding:20px;font:14px system-ui;z-index:2147483640}.da-issue-dialog::backdrop{background:#000a}.da-issue-dialog h2{margin:0 0 15px;color:#5be6e7;font-size:21px}.da-issue-dialog label{display:block;margin:12px 0}.da-issue-dialog select,.da-issue-dialog textarea{display:block;width:100%;box-sizing:border-box;padding:9px;background:#071416;border:1px solid #375c62;color:#eaffff;border-radius:7px;font:inherit}.da-issue-dialog input[type=checkbox]{margin-right:7px}.da-issue-dialog p{margin:10px 0;overflow-wrap:anywhere}.da-issue-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.da-issue-dialog .da-issue-primary{background:#55dddd;color:#062023;font-weight:700}.da-issue-dialog button:disabled{opacity:.5;cursor:default}.da-issue-dialog [hidden]{display:none!important}.da-issue-dialog button[aria-pressed=true]{border-color:#00eaf4;color:#00eaf4}.da-issue-row{border:1px solid #285057;border-radius:8px;padding:12px;margin:10px 0}.da-issue-dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font-size:11px}.da-issue-muted{color:#b4c9cb;font-size:12px}';
    d.head.append(style);
    const dialog=()=>{const x=el('dialog',undefined,'da-issue-dialog');x.setAttribute('data-da-issue','');x.addEventListener('keydown',e=>e.stopPropagation());x.addEventListener('close',()=>x.remove());d.body.append(x);return x};
    const show=x=>{if(typeof x.showModal==='function')x.showModal();else{x.setAttribute('open','');x.style.position='fixed';x.style.inset='10% auto auto 3%'}};
    const close=x=>{if(typeof x.close==='function')x.close();else x.remove()};
    const live=()=>{
      const inspect=id=>{const v=d.getElementById(id);if(!v)return null;let stream=null;try{stream=v.srcObject?.getTracks?.().map(t=>({kind:t.kind,state:t.readyState,muted:t.muted,enabled:t.enabled}))||null}catch{}return {stream,paused:v.paused,muted:v.muted,ready:v.readyState,size:[v.videoWidth,v.videoHeight]}};
      return {page:contextFor(w.location,d).page,mode:w.DARTARENA_ACTIVE_MEDIA_MODE,online:w.navigator.onLine,visible:!d.hidden,local:inspect('localVideo'),remote:inspect('remoteVideo')};
    };
    function openReport(){
      if(d.querySelector('dialog[data-da-issue][open]'))return;
      const x=dialog();x.append(el('h2',tr('Rapporter et problem','Report an issue')));
      const f=el('form'),cat=el('select');cat.required=true;
      for(const c of categories){const o=el('option',tr(...titles[c]));o.value=c;cat.append(o)}
      const cl=el('label',tr('Kategori','Category'));cl.append(cat);
      const desc=el('textarea');desc.required=true;desc.maxLength=2000;desc.rows=4;desc.placeholder=tr('Hva skjedde?','What happened?');
      const dl=el('label',tr('Beskrivelse','Description'));dl.append(desc);
      const opt=el('input');opt.type='checkbox';const ol=el('label');ol.append(opt,d.createTextNode(tr('Legg ved tekniske logger','Include technical diagnostics')));
      const hint=el('p',tr('Kun tekniske hendelser fra denne fanen og nettlesertype. Ingen video, lyd, tokens eller rå konsolltekst. Ikke skriv passord eller personopplysninger i beskrivelsen.','Only technical events from this tab and browser type. No video, audio, tokens or raw console text. Do not include passwords or personal information in the description.'),'da-issue-muted');
      const status=el('p');status.setAttribute('role','status');
      const actions=el('div',undefined,'da-issue-actions'),send=el('button',tr('Send rapport','Submit report'),'da-issue-primary');send.type='submit';actions.append(send,btn(tr('Lukk','Close'),()=>close(x)));
      f.append(cl,dl,ol,hint,status,actions);x.append(f);
      cat.addEventListener('change',()=>{if(cat.value==='suggestion')opt.checked=false});
      f.addEventListener('submit',async e=>{
        e.preventDefault();const description=desc.value.trim();if(!description)return;
        send.disabled=true;status.textContent=tr('Sender…','Submitting…');
        try{
          const c=client();if(!c)throw new Error('no-session');
          const {data,error}=await c.auth.getSession();if(error||!data?.session?.user)throw new Error('no-session');
          const ctx=contextFor(w.location,d);let diag=null;
          if(opt.checked){let raw=null;try{raw=w.sessionStorage.getItem('dartarena-media-trace-v1')}catch{}diag=diagnostics(raw,w.navigator.userAgent,live(),errors)}
          const {error:writeError}=await c.from('issue_reports').insert({category:cat.value,description,page:ctx.page,context:ctx.context,diagnostics:diag});
          if(writeError)throw writeError;
          status.textContent=tr('Rapport sendt. Takk!','Report submitted. Thank you!');desc.disabled=true;cat.disabled=true;opt.disabled=true;
        }catch(err){status.textContent=err?.message==='no-session'?tr('Du må være innlogget for å sende rapport.','Please sign in to submit a report.'):err?.code==='P0001'?tr('For mange rapporter. Prøv igjen senere.','Too many reports. Try again later.'):tr('Kunne ikke sende. Teksten er beholdt – prøv igjen.','Could not submit. Your text is preserved – try again.');send.disabled=false}
      });
      show(x);
    }
    async function captureAvatar(target,c){
      const urls=await w.DartArenaIdentity?.getUrls(c,[target]);const url=urls?.get(target);if(!url)throw Error('avatar_missing');
      const response=await w.fetch(url,{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('avatar_missing');
      const blob=await response.blob();if(blob.type!=='image/jpeg'||blob.size>102400||!blob.size)throw Error('avatar_invalid');
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return w.btoa(binary);
    }
    function openPlayerReport(target){
      if(d.querySelector('dialog[data-da-issue][open]')||!uuid(target))return;
      const x=dialog();x.append(el('h2',tr('Rapporter spiller','Report player')),el('p',d.getElementById('playerName')?.textContent||'', 'da-issue-muted'));
      const f=el('form'),cat=el('select');cat.required=true;
      for(const [key,label] of Object.entries(playerTitles)){const o=el('option',tr(...label));o.value=key;cat.append(o)}
      const cl=el('label',tr('Kategori','Category'));cl.append(cat);
      const desc=el('textarea');desc.required=true;desc.maxLength=2000;desc.rows=4;desc.placeholder=tr('Beskriv hva som har skjedd.','Describe what happened.');
      const dl=el('label',tr('Beskrivelse','Description'));dl.append(desc);
      const opt=el('input');opt.type='checkbox';const ol=el('label');ol.hidden=true;ol.append(opt,d.createTextNode(tr('Legg ved kopi av profilbildet (hvis tilgjengelig)','Attach a copy of the profile picture (if available)')));
      cat.onchange=()=>{ol.hidden=cat.value!=='avatar';opt.checked=cat.value==='avatar'&&!!d.querySelector('#profileAvatar img[data-player-avatar]')};
      const hint=el('p',tr('Kun Admin/Owner som ikke selv er rapportert i saken kan lese rapporten. Spilleren varsles ikke om hvem som rapporterer. Navn på rapporttidspunktet lagres. Ikke legg inn unødvendige personopplysninger.','Only Admin/Owner who are not the subject of the case can read the report. The player is not notified of who reported them. Names at report time are saved. Do not include unnecessary personal information.'),'da-issue-muted');
      const status=el('p');status.setAttribute('role','status');
      const actions=el('div',undefined,'da-issue-actions'),send=el('button',tr('Send rapport','Submit report'),'da-issue-primary');send.type='submit';const cancel=btn(tr('Lukk','Close'),()=>close(x));actions.append(send,cancel);
      f.append(cl,dl,ol,hint,status,actions);x.append(f);
      let busy=false;x.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
      f.onsubmit=async e=>{e.preventDefault();if(busy||send.disabled||!desc.value.trim())return;busy=true;send.disabled=cancel.disabled=cat.disabled=desc.disabled=opt.disabled=true;status.textContent=tr('Sender…','Submitting…');
       try{const c=client(),{data,error}=await c.auth.getSession();if(error||!data?.session?.user||data.session.user.id===target)throw Error('invalid_target');
        let evidence=null;if(cat.value==='avatar'&&opt.checked){try{evidence=await captureAvatar(target,c)}catch{throw Error('avatar_capture_failed')}}
        const {error:writeError}=await c.rpc('submit_player_report',{p_target_id:target,p_category:cat.value,p_description:desc.value.trim(),p_avatar_evidence:evidence});if(writeError)throw writeError;
        status.textContent=tr('Rapport sendt. Takk!','Report submitted. Thank you!');cancel.disabled=false;
       }catch(err){status.textContent=err?.message==='avatar_capture_failed'?tr('Kunne ikke hente profilbildet. Prøv igjen eller fjern avhukingen for å sende uten bilde.','Could not capture the profile picture. Retry or uncheck the box to submit without it.'):err?.code==='P0001'?tr('For mange rapporter. Prøv igjen senere.','Too many reports. Try again later.'):tr('Kunne ikke sende. Teksten er beholdt – prøv igjen.','Could not submit. Your text is preserved – try again.');send.disabled=cancel.disabled=cat.disabled=desc.disabled=opt.disabled=false}
       finally{busy=false}
      };
      show(x);
    }
    async function openAdmin(){
      if(d.querySelector('dialog[data-da-issue][open]'))return;
      const x=dialog(),c=client(),list=el('div'),status=el('p');
      const head=el('div',undefined,'da-issue-actions');
      x.append(el('h2',tr('Rapportsenter','Issue Center')),head,status,list);
      let section='technical',request=0;
      const filter=el('select');
      const technical=btn(tr('Tekniske rapporter','Technical reports'),()=>switchSection('technical'));
      const players=btn(tr('Spillerrapporter','Player reports'),()=>switchSection('players'));
      function switchSection(next){section=next;technical.setAttribute('aria-pressed',String(next==='technical'));players.setAttribute('aria-pressed',String(next==='players'));filter.replaceChildren();for(const [v,no,eng] of [['all','Alle','All'],...(next==='players'?playerStates:[['new','Nye','New'],['investigating','Undersøkes','Investigating'],['resolved','Løst','Resolved']])]){const o=el('option',tr(no,eng));o.value=v;filter.append(o)}}
      head.append(technical,players,filter,btn(tr('Oppdater','Refresh'),load),btn(tr('Lukk','Close'),()=>close(x)));filter.onchange=load;
      technical.addEventListener('click',load);players.addEventListener('click',load);switchSection('technical');
      async function load(){
        const token=++request;const playerMode=section==='players';status.textContent=tr('Laster…','Loading…');list.replaceChildren();
        try{
          const {data:admin,error:roleError}=await c.rpc('is_admin');if(roleError||!admin)throw Error('denied');
          let q=playerMode?c.from('player_reports').select('id,reporter_id,target_id,target_nickname,target_full_name,reporter_nickname,created_at,category,description,status').order('created_at',{ascending:false}).limit(50):c.from('issue_reports').select('id,user_id,created_at,category,description,page,status').order('created_at',{ascending:false}).limit(50);
          if(filter.value!=='all')q=q.eq('status',filter.value);
          const {data,error}=await q;if(token!==request)return;if(error)throw error;
          status.textContent=tr('Viser inntil 50 siste rapporter.','Showing up to 50 latest reports.');
          for(const r of data||[]){const card=el('div',undefined,'da-issue-row');
            if(playerMode){card.append(el('strong',tr(...(playerTitles[r.category]||playerTitles.other))+' · '+r.status),el('p',tr('Rapportert spiller: ','Reported player: ')+(r.target_nickname||'')+(r.target_full_name?' · '+r.target_full_name:'')),el('p',r.description),el('p',new Date(r.created_at).toLocaleString()+' · '+tr('Rapportert av: ','Reported by: ')+r.reporter_nickname,'da-issue-muted'),btn(tr('Åpne','Open'),()=>playerDetail(r.id,card)))}
            else card.append(el('strong',tr(...(titles[r.category]||titles.other))+' · '+r.status),el('p',r.description),el('p',new Date(r.created_at).toLocaleString()+' · '+r.page+' · '+r.user_id,'da-issue-muted'),btn(tr('Åpne','Open'),()=>detail(r.id,card)));
            list.append(card)
          }
          if(!data?.length)list.append(el('p',tr('Ingen rapporter.','No reports.')));
        }catch{if(token===request)status.textContent=tr('Ingen tilgang, eller kunne ikke laste rapporter.','Access denied or unable to load reports.')}
      }
      async function playerDetail(id,card){
        if(card.querySelector('[data-detail]'))return;const box=el('div');box.dataset.detail='1';card.append(box);box.textContent=tr('Laster…','Loading…');
        try{const {data:r,error}=await c.from('player_reports').select('id,target_id,reporter_id,target_nickname,target_full_name,target_display_mode,reporter_nickname,avatar_updated_at,avatar_evidence,status,internal_note,handled_by,handled_at').eq('id',id).single();if(error||!r)throw Error();
          box.replaceChildren(el('p',tr('Navn ved rapportering: ','Name at report time: ')+r.target_nickname+' · '+(r.target_full_name||'–')+' · '+r.target_display_mode),el('p',tr('Spiller-ID: ','Player ID: ')+r.target_id,'da-issue-muted'),el('p',tr('Rapportør-ID: ','Reporter ID: ')+r.reporter_id,'da-issue-muted'));
          for(const [uid,label] of [[r.target_id,tr('Åpne spillerprofil','Open player profile')],[r.reporter_id,tr('Åpne rapportørprofil','Open reporter profile')]])if(uuid(uid)){const a=el('a',label);a.href='player.html?id='+encodeURIComponent(uid);a.target='_blank';a.rel='noopener noreferrer';box.append(a,el('p',''))}
          if(r.avatar_updated_at)box.append(el('p',tr('Registrert bilde oppdatert: ','Recorded avatar updated: ')+new Date(r.avatar_updated_at).toLocaleString(),'da-issue-muted'));
          if(r.avatar_evidence&&/^[A-Za-z0-9+/]+={0,2}$/.test(r.avatar_evidence)&&r.avatar_evidence.length<=136536){const img=el('img');img.src='data:image/jpeg;base64,'+r.avatar_evidence;img.alt=tr('Vedlagt profilbilde','Attached profile picture');img.style.cssText='max-width:160px;max-height:160px;border-radius:8px;display:block';box.append(el('p',tr('Bildekopi fra rapportøren (ikke uavhengig verifisert).','Image copy from reporter (not independently verified).'),'da-issue-muted'),img)}
          else box.append(el('p',tr('Ingen lagret bildevedlegg.','No stored image attachment.'),'da-issue-muted'));
          if(r.handled_at)box.append(el('p',tr('Sist behandlet: ','Last handled: ')+new Date(r.handled_at).toLocaleString()+' · '+r.handled_by,'da-issue-muted'));
          const s=el('select');for(const [v,no,eng] of playerStates){const o=el('option',tr(no,eng));o.value=v;s.append(o)}s.value=r.status;
          const n=el('textarea');n.rows=3;n.maxLength=2000;n.value=r.internal_note||'';n.placeholder=tr('Internt notat','Internal note');const msg=el('p');msg.setAttribute('role','status');
          const save=btn(tr('Lagre','Save'),async()=>{save.disabled=true;try{const {data,error}=await c.from('player_reports').update({status:s.value,internal_note:n.value}).eq('id',id).select('id');if(error||!data?.length)throw Error();await load()}catch{msg.textContent=tr('Kunne ikke lagre.','Unable to save.');save.disabled=false}});
          box.append(s,n,save,msg);
        }catch{box.textContent=tr('Kunne ikke åpne rapport.','Unable to open report.')}
      }
      async function detail(id,card){
        if(card.querySelector('[data-detail]'))return;
        const box=el('div');box.dataset.detail='1';card.append(box);box.textContent=tr('Laster…','Loading…');
        try{
          const {data:r,error}=await c.from('issue_reports').select('id,context,diagnostics,status,internal_note').eq('id',id).single();if(error)throw error;
          box.replaceChildren(el('pre',JSON.stringify(r.context,null,2)));
          if(r.diagnostics)box.append(btn(tr('Last ned diagnostikk','Download diagnostics'),()=>{
            const url=URL.createObjectURL(new Blob([JSON.stringify(r.diagnostics,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='dartarena-issue-'+id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
          }));else box.append(el('p',tr('Ingen diagnostikk vedlagt.','No diagnostics attached.')));
          const s=el('select');for(const [v,no,eng] of [['new','Ny','New'],['investigating','Undersøkes','Investigating'],['resolved','Løst','Resolved']]){const o=el('option',tr(no,eng));o.value=v;s.append(o)}s.value=r.status;
          const n=el('textarea');n.rows=3;n.maxLength=2000;n.value=r.internal_note||'';n.placeholder=tr('Internt notat','Internal note');const msg=el('p');msg.setAttribute('role','status');
          const save=btn(tr('Lagre','Save'),async()=>{save.disabled=true;try{const {data,error}=await c.from('issue_reports').update({status:s.value,internal_note:n.value}).eq('id',id).select('id');if(error||!data?.length)throw Error();await load()}catch{msg.textContent=tr('Kunne ikke lagre.','Unable to save.');save.disabled=false}});
          box.append(s,n,save,msg);
        }catch{box.textContent=tr('Kunne ikke åpne rapport.','Unable to open report.')}
      }
      show(x);await load();
    }
    const launcher=btn(tr('Rapporter feil','Report issue'),openReport,'da-issue-button da-issue-launch');launcher.id='daIssueReportBtn';
    d.body.append(launcher);
    const reportButton=d.getElementById('reportPlayerBtn');if(reportButton){const target=uuid(new URLSearchParams(w.location.search).get('id'));const c=client();if(target&&c)void (async()=>{try{const {data}=await c.auth.getSession();if(!data?.session?.user||data.session.user.id===target)return;const {data:profile,error}=await c.from('profiles').select('id').eq('id',target).maybeSingle();if(!error&&profile){reportButton.hidden=false;reportButton.onclick=()=>openPlayerReport(target)}}catch{}})();}
    function addAdminIcon(b){
      const ns='http://www.w3.org/2000/svg',svg=d.createElementNS(ns,'svg');
      for(const [key,value] of Object.entries({'aria-hidden':'true',focusable:'false',viewBox:'0 0 24 24',width:'17',height:'17',style:'vertical-align:-3px;margin-right:5px;fill:none;stroke:#00eaf4;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round'}))svg.setAttribute(key,value);
      const path=d.createElementNS(ns,'path');
      path.setAttribute('d','M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M9 3h6v4H9zM8 12h2m3 0h3M8 17h2m3 0h3');
      svg.append(path);
      const label=el('span',tr('Rapportsenter','Issue Center'));label.id='daIssueAdminLabel';
      b.replaceChildren(svg,label);
    }
    const refreshAdminLabel=()=>{const label=d.getElementById('daIssueAdminLabel');if(label)label.textContent=tr('Rapportsenter','Issue Center')};
    const host=d.getElementById('lobbyStatsActions');
    if(host){
      const c=client();
      const refresh=async()=>{try{const {data}=await c.auth.getSession();const {data:admin}=data?.session?await c.rpc('is_admin'):{data:false};const old=d.getElementById('daIssueAdminBtn');if(!admin){old?.remove();return}if(!old){const b=btn(tr('Rapportsenter','Issue Center'),openAdmin,'small-btn lobby-utility-btn');b.id='daIssueAdminBtn';addAdminIcon(b);host.append(b)}}catch{}};
      if(c){refresh();c.auth.onAuthStateChange(()=>setTimeout(refresh,0))}
    }
    w.addEventListener('storage',()=>{launcher.textContent=tr('Rapporter feil','Report issue');refreshAdminLabel()});
    // Same-tab language changes also update the two dynamic labels.
    d.addEventListener('click',e=>{if(e.target.closest?.('[data-language]'))setTimeout(()=>{launcher.textContent=tr('Rapporter feil','Report issue');refreshAdminLabel()},0)});
  }
  return {sanitizeEvent,diagnostics,contextFor,browserInfo,boot};
});
