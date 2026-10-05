// DartArena live spectator counter using Supabase Realtime Presence.
// Players in the match are deliberately excluded from the viewer count.
(function(){
  const params=new URLSearchParams(location.search),matchId=params.get('id');
  if(!matchId||!window.supabase)return;
  const URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const presenceDb=window.supabase.createClient(URL,KEY),number=document.getElementById('viewerCountNumber'),pill=document.getElementById('viewerCount');
  let ch=null,myId=null,isPlayer=false,myName='Gjest',popover=null;

  function ensurePopover(){
    if(!pill)return null;
    if(popover?.isConnected)return popover;
    pill.style.position='relative';
    pill.style.cursor='pointer';
    pill.removeAttribute('title');
    pill.querySelectorAll('[title]').forEach(el=>el.removeAttribute('title'));
    const style=document.createElement('style');
    style.id='dartarena-spectator-popover-style';
    style.textContent=`
      #viewerCount .da-spectator-popover{
        position:absolute;
        top:calc(100% + 9px);
        right:0;
        z-index:120;
        min-width:220px;
        max-width:min(320px,82vw);
        padding:11px 12px;
        border:1px solid rgba(35,226,209,.28);
        border-radius:12px;
        background:linear-gradient(145deg,#0d191c,#091315);
        box-shadow:0 18px 55px rgba(0,0,0,.55),0 0 18px rgba(35,226,209,.06);
        color:var(--text);
        opacity:0;
        visibility:hidden;
        transform:translateY(-4px);
        transition:.14s ease;
        pointer-events:none;
      }
      #viewerCount.da-spectator-open .da-spectator-popover{
        opacity:1;
        visibility:visible;
        transform:translateY(0);
        pointer-events:auto;
      }
      .da-spectator-popover small{
        display:block;
        margin-bottom:7px;
        color:var(--cyan);
        font-size:9px;
        font-weight:950;
        letter-spacing:.12em;
      }
      .da-spectator-popover-list{display:grid;gap:6px}
      .da-spectator-popover-name{
        padding:7px 8px;
        border-radius:8px;
        background:rgba(255,255,255,.035);
        border:1px solid rgba(255,255,255,.07);
        font-size:12px;
        font-weight:800;
        color:var(--text);
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .da-spectator-popover-empty{color:var(--muted);font-size:12px}
    `;
    if(!document.getElementById(style.id))document.head.appendChild(style);
    popover=document.createElement('div');
    popover.className='da-spectator-popover';
    popover.setAttribute('role','status');
    popover.innerHTML='<small>SER PÅ</small><div class="da-spectator-popover-list"></div>';
    pill.appendChild(popover);

    let hideTimer=null;
    const open=()=>{clearTimeout(hideTimer);pill.classList.add('da-spectator-open')};
    const close=()=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>pill.classList.remove('da-spectator-open'),120)};
    pill.addEventListener('mouseenter',open);
    pill.addEventListener('mouseleave',close);
    pill.addEventListener('focusin',open);
    pill.addEventListener('focusout',close);
    pill.addEventListener('click',event=>{
      if(event.target.closest('.da-spectator-popover'))return;
      pill.classList.toggle('da-spectator-open');
    });
    return popover;
  }

  function spectators(){
    if(!ch)return[];
    const unique=new Map();
    Object.values(ch.presenceState()).flat().forEach(p=>{
      if(p?.role!=='spectator')return;
      const key=p.user_id||p.presence_ref||crypto.randomUUID();
      if(!unique.has(key))unique.set(key,{id:key,name:String(p.username||'Gjest')});
    });
    return [...unique.values()];
  }

  function render(){
    if(!ch)return;
    const viewers=spectators();
    if(number)number.textContent=String(viewers.length);
    if(!pill)return;
    const names=viewers.map(v=>v.name).sort((a,b)=>a.localeCompare(b,'nb'));
    const description=!names.length
      ?'Ingen tilskuere akkurat nå'
      :`Ser på: ${names.join(', ')}`;
    pill.removeAttribute('title');
    pill.querySelectorAll('[title]').forEach(el=>el.removeAttribute('title'));
    pill.setAttribute('aria-label',`${viewers.length} tilskuere ser på kampen. ${description}`);
    const box=ensurePopover();
    const list=box?.querySelector('.da-spectator-popover-list');
    if(list){
      list.innerHTML=names.length
        ?names.map(name=>{const row=document.createElement('div');row.className='da-spectator-popover-name';row.textContent=name;return row.outerHTML}).join('')
        :'<div class="da-spectator-popover-empty">Ingen tilskuere akkurat nå</div>';
    }
  }

  (async()=>{
    const {data:{session}}=await presenceDb.auth.getSession();
    myId=session?.user?.id||`guest-${crypto.randomUUID()}`;
    if(session?.user?.id){
      const [{data:m},{data:p}]=await Promise.all([
        presenceDb.from('matches').select('player1_id,player2_id').eq('id',matchId).maybeSingle(),
        presenceDb.from('profiles').select('username').eq('id',session.user.id).maybeSingle()
      ]);
      isPlayer=!!m&&[m.player1_id,m.player2_id].includes(session.user.id);
      myName=p?.username||'Tilskuer';
    }
    ch=presenceDb.channel(`match-viewers-${matchId}`,{config:{presence:{key:myId}}})
      .on('presence',{event:'sync'},render)
      .on('presence',{event:'join'},render)
      .on('presence',{event:'leave'},render)
      .subscribe(async status=>{
        if(status!=='SUBSCRIBED')return;
        await ch.track({
          user_id:myId,
          username:myName,
          role:isPlayer?'player':'spectator',
          online_at:new Date().toISOString()
        });
        render();
      });
  })();

  window.addEventListener('pagehide',()=>{try{ch?.untrack()}catch{}});
})();