(()=>{
  const pill=document.querySelector('.viewer-pill');
  const number=document.getElementById('viewerCount');
  if(!pill||!number)return;

  if(!document.getElementById('tournament-viewer-presence-names-style')){
    const style=document.createElement('style');
    style.id='tournament-viewer-presence-names-style';
    style.textContent=`
      .viewer-pill{position:relative;cursor:help;outline:none}
      .viewer-pill:focus-visible{box-shadow:0 0 0 2px rgba(43,215,204,.35)}
      .viewer-names-tooltip{position:absolute;right:0;top:calc(100% + 9px);z-index:80;min-width:190px;max-width:min(320px,80vw);padding:10px 12px;border:1px solid rgba(43,215,204,.38);border-radius:11px;background:rgba(5,13,15,.97);box-shadow:0 10px 30px rgba(0,0,0,.38);color:var(--text);font-size:12px;font-weight:700;line-height:1.5;white-space:pre-line;opacity:0;visibility:hidden;transform:translateY(-3px);pointer-events:none;transition:opacity .14s ease,transform .14s ease,visibility .14s ease}
      .viewer-pill:hover .viewer-names-tooltip,.viewer-pill:focus .viewer-names-tooltip,.viewer-pill.viewer-tooltip-open .viewer-names-tooltip{opacity:1;visibility:visible;transform:translateY(0)}
      .viewer-names-tooltip::before{content:'SER PÅ';display:block;margin-bottom:5px;color:#00eaf4;font-size:9px;font-weight:950;letter-spacing:.1em}
      @media(max-width:700px){.viewer-names-tooltip{left:0;right:auto}}
    `;
    document.head.appendChild(style);
  }

  let tooltip=pill.querySelector('.viewer-names-tooltip');
  if(!tooltip){
    tooltip=document.createElement('span');
    tooltip.className='viewer-names-tooltip';
    tooltip.setAttribute('role','tooltip');
    pill.appendChild(tooltip);
  }
  pill.tabIndex=0;

  function currentPresence(){
    try{return typeof presence!=='undefined'?presence:null}catch{return null}
  }

  function spectators(){
    const ch=currentPresence();
    if(!ch)return[];
    const unique=new Map();
    Object.values(ch.presenceState()||{}).flat().forEach(p=>{
      if(p?.role!=='spectator')return;
      const key=String(p.user_id||p.presence_ref||'unknown');
      const name=String(p.username||'Tilskuer').trim()||'Tilskuer';
      const existing=unique.get(key);
      if(!existing||existing==='Tilskuer')unique.set(key,name);
    });
    return [...unique.values()].sort((a,b)=>a.localeCompare(b,'nb'));
  }

  function renderNames(){
    const names=spectators();
    number.textContent=String(names.length);
    tooltip.textContent=names.length?names.join('\n'):'Ingen tilskuere akkurat nå';
    const title=names.length?`Ser på: ${names.join(', ')}`:'Ingen tilskuere akkurat nå';
    pill.title=title;
    pill.setAttribute('aria-label',`${names.length} ser på. ${title}`);
  }

  async function publishOwnName(){
    try{
      if(typeof db==='undefined')return;
      const {data:{session}}=await db.auth.getSession();
      if(!session?.user?.id)return;
      const {data:p}=await db.from('profiles').select('username').eq('id',session.user.id).maybeSingle();
      const username=p?.username||'Tilskuer';
      for(let i=0;i<40;i++){
        const ch=currentPresence();
        if(ch){
          await ch.track({user_id:session.user.id,username,role:'spectator',online_at:new Date().toISOString()});
          renderNames();
          return;
        }
        await new Promise(r=>setTimeout(r,250));
      }
    }catch(e){console.warn('Could not publish spectator name',e)}
  }

  pill.addEventListener('click',()=>pill.classList.toggle('viewer-tooltip-open'));
  document.addEventListener('click',event=>{
    if(!pill.contains(event.target))pill.classList.remove('viewer-tooltip-open');
  });

  const timer=setInterval(renderNames,400);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  publishOwnName();
  renderNames();
})();