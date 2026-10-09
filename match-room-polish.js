(()=>{
  if(window.__dartArenaMatchRoomPolish)return;
  window.__dartArenaMatchRoomPolish=true;

  const style=document.createElement('style');
  style.id='dartarena-match-room-polish-style';
  style.textContent=`
    body.match-page .match-head>div:first-child>small{display:block;font-size:15px;line-height:1.15;letter-spacing:.08em;font-weight:950;margin-bottom:8px}
    body.match-page .match-head #matchTitle{margin:0 0 8px;line-height:1.08}
    body.match-page .match-head #matchTitle .da-match-header-name{font:inherit}
    body.match-page .match-head #matchTitle .player-role-badge{font-size:9px;padding:3px 7px;margin:0 5px 0 7px;transform:translateY(-3px)}

    .da-match-status-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:1px 0 10px}
    .da-match-status-row #matchStatus{margin:0!important;line-height:1.1}
    .da-match-live-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:950;letter-spacing:.09em;line-height:1.3}
    .da-match-live-badge.is-live{color:#00eaf4;border:1px solid rgba(0,234,244,.55);background:rgba(0,234,244,.10);box-shadow:0 0 11px rgba(0,234,244,.07)}
    .da-match-live-badge.is-private{color:#aab9bb;border:1px solid rgba(170,185,187,.30);background:rgba(255,255,255,.035)}

    body.match-page .match-name.da-role-owner,
    body.match-page .cricket-player-name.da-role-owner,
    body.match-page .half-player-name.da-role-owner,
    body.match-page .sixty-one-player-name.da-role-owner,
    body.match-page .video-name.da-role-owner,
    body.match-page .video-slot-label.da-role-owner{color:#00eaf4!important}
    body.match-page .match-name.da-role-admin,
    body.match-page .cricket-player-name.da-role-admin,
    body.match-page .half-player-name.da-role-admin,
    body.match-page .sixty-one-player-name.da-role-admin,
    body.match-page .video-name.da-role-admin,
    body.match-page .video-slot-label.da-role-admin{color:#ff9f43!important}

    body.match-page .match-name.da-role-owner::after,
    body.match-page .match-name.da-role-admin::after,
    body.match-page .cricket-player-name.da-role-owner::after,
    body.match-page .cricket-player-name.da-role-admin::after,
    body.match-page .half-player-name.da-role-owner::after,
    body.match-page .half-player-name.da-role-admin::after,
    body.match-page .sixty-one-player-name.da-role-owner::after,
    body.match-page .sixty-one-player-name.da-role-admin::after,
    body.match-page .video-name.da-role-owner::after,
    body.match-page .video-name.da-role-admin::after,
    body.match-page .video-slot-label.da-role-owner::after,
    body.match-page .video-slot-label.da-role-admin::after{
      display:inline-flex;align-items:center;margin-left:6px;padding:2px 6px;border-radius:999px;font-size:8px;font-weight:950;letter-spacing:.08em;line-height:1.25;vertical-align:1px
    }
    body.match-page .match-name.da-role-owner::after,
    body.match-page .cricket-player-name.da-role-owner::after,
    body.match-page .half-player-name.da-role-owner::after,
    body.match-page .sixty-one-player-name.da-role-owner::after,
    body.match-page .video-name.da-role-owner::after,
    body.match-page .video-slot-label.da-role-owner::after{content:'OWNER';color:#00eaf4;border:1px solid rgba(0,234,244,.52);background:rgba(0,234,244,.10)}
    body.match-page .match-name.da-role-admin::after,
    body.match-page .cricket-player-name.da-role-admin::after,
    body.match-page .half-player-name.da-role-admin::after,
    body.match-page .sixty-one-player-name.da-role-admin::after,
    body.match-page .video-name.da-role-admin::after,
    body.match-page .video-slot-label.da-role-admin::after{content:'ADMIN';color:#ff9f43;border:1px solid rgba(255,159,67,.50);background:rgba(255,159,67,.10)}
    body.match-page .video-name.da-role-owner,
    body.match-page .video-name.da-role-admin,
    body.match-page .video-slot-label.da-role-owner,
    body.match-page .video-slot-label.da-role-admin{display:inline-flex!important;align-items:center;max-width:calc(100% - 110px);white-space:nowrap}

    @media(max-width:620px){
      body.match-page .match-head>div:first-child>small{font-size:13px;margin-bottom:7px}
      body.match-page .match-head #matchTitle{margin-bottom:7px}
      body.match-page .match-head #matchTitle .player-role-badge{font-size:8px;padding:2px 6px;margin-left:5px;transform:translateY(-2px)}
      body.match-page .video-name.da-role-owner::after,
      body.match-page .video-name.da-role-admin::after,
      body.match-page .video-slot-label.da-role-owner::after,
      body.match-page .video-slot-label.da-role-admin::after{font-size:7px;padding:2px 5px;margin-left:5px}
    }
  `;
  document.head.appendChild(style);

  function ensureHeaderNames(){
    const title=document.getElementById('matchTitle');
    if(!title)return;
    if(document.getElementById('matchPlayer1Name')&&document.getElementById('matchPlayer2Name'))return;

    let p1='',p2='';
    if(typeof m!=='undefined'&&m&&typeof names!=='undefined'&&names){
      p1=names[m.player1_id]||'';
      p2=names[m.player2_id]||'';
    }
    if(!p1||!p2){
      const text=title.textContent.trim();
      const parts=text.split(/\s+vs\s+/i);
      if(parts.length!==2)return;
      [p1,p2]=parts.map(x=>x.trim());
    }
    if(!p1||!p2||p1==='Kamprom'||p2==='Kamprom')return;

    const a=document.createElement('span');
    a.id='matchPlayer1Name';
    a.className='da-match-header-name';
    a.textContent=p1;
    const b=document.createElement('span');
    b.id='matchPlayer2Name';
    b.className='da-match-header-name';
    b.textContent=p2;
    const vs=document.createElement('span');
    vs.className='match-vs';
    vs.textContent=' vs ';
    title.replaceChildren(a,vs,b);
  }

  function applyRoles(){
    ensureHeaderNames();
    const api=window.DartArenaRoleVisuals;
    if(!api)return;
    document.querySelectorAll('#matchPlayer1Name,#matchPlayer2Name,.match-name,.cricket-player-name,.half-player-name,.sixty-one-player-name,.video-name,.video-slot-label').forEach(el=>api.apply?.(el));
    api.scan?.();
  }

  function ensureStatusBadge(){
    const status=document.getElementById('matchStatus');
    if(!status)return null;
    let row=document.getElementById('matchStatusLine');
    let badge=document.getElementById('matchLiveBadge');
    if(!row){
      row=document.createElement('div');
      row.id='matchStatusLine';
      row.className='da-match-status-row';
      status.insertAdjacentElement('beforebegin',row);
      row.appendChild(status);
    }
    if(!badge){
      badge=document.createElement('span');
      badge.id='matchLiveBadge';
      badge.className='da-match-live-badge';
      row.appendChild(badge);
    }
    return badge;
  }

  function sync(){
    applyRoles();
    if(typeof m==='undefined'||!m)return;
    const badge=ensureStatusBadge();
    const playing=m.status==='playing';
    const live=m.is_live!==false;
    if(badge){
      badge.className=`da-match-live-badge ${live?'is-live':'is-private'}${playing?'':' hidden'}`;
      badge.textContent=live?'LIVE':'IKKE LIVE';
    }
    const viewers=document.getElementById('viewerCount');
    if(viewers)viewers.classList.toggle('hidden',!live);
  }

  if(typeof render==='function'&&!window.__dartArenaMatchRoomRenderHook){
    window.__dartArenaMatchRoomRenderHook=true;
    const baseRender=render;
    render=function(...args){
      const result=baseRender.apply(this,args);
      sync();
      return result;
    };
  }

  [0,120,350,800,1500,2600].forEach(delay=>setTimeout(sync,delay));
  document.addEventListener('DOMContentLoaded',sync,{once:true});
  window.addEventListener('load',sync,{once:true});
})();
