(()=>{
  if(window.__dartArenaMatchRoomPolish)return;
  window.__dartArenaMatchRoomPolish=true;

  const style=document.createElement('style');
  style.id='dartarena-match-room-polish-style';
  style.textContent=`
    .da-match-status-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:1px 0 10px}
    .da-match-status-row #matchStatus{margin:0!important;line-height:1.1}
    .da-match-live-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:950;letter-spacing:.09em;line-height:1.3}
    .da-match-live-badge.is-live{color:#23e2d1;border:1px solid rgba(35,226,209,.55);background:rgba(35,226,209,.10);box-shadow:0 0 11px rgba(35,226,209,.07)}
    .da-match-live-badge.is-private{color:#aab9bb;border:1px solid rgba(170,185,187,.30);background:rgba(255,255,255,.035)}

    body.match-page .match-name.da-role-owner,
    body.match-page .video-name.da-role-owner{color:#23e2d1!important}
    body.match-page .match-name.da-role-admin,
    body.match-page .video-name.da-role-admin{color:#ff9f43!important}

    body.match-page .match-name.da-role-owner::after,
    body.match-page .match-name.da-role-admin::after,
    body.match-page .video-name.da-role-owner::after,
    body.match-page .video-name.da-role-admin::after{
      display:inline-flex;align-items:center;margin-left:6px;padding:2px 6px;border-radius:999px;font-size:8px;font-weight:950;letter-spacing:.08em;line-height:1.25;vertical-align:1px
    }
    body.match-page .match-name.da-role-owner::after,
    body.match-page .video-name.da-role-owner::after{content:'OWNER';color:#23e2d1;border:1px solid rgba(35,226,209,.52);background:rgba(35,226,209,.10)}
    body.match-page .match-name.da-role-admin::after,
    body.match-page .video-name.da-role-admin::after{content:'ADMIN';color:#ff9f43;border:1px solid rgba(255,159,67,.50);background:rgba(255,159,67,.10)}
    body.match-page .video-name.da-role-owner,
    body.match-page .video-name.da-role-admin{display:inline-flex!important;align-items:center;max-width:calc(100% - 110px);white-space:nowrap}
    @media(max-width:620px){
      body.match-page .video-name.da-role-owner::after,
      body.match-page .video-name.da-role-admin::after{font-size:7px;padding:2px 5px;margin-left:5px}
    }
  `;
  document.head.appendChild(style);

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
    window.DartArenaRoleVisuals?.scan?.();
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

  sync();
  document.addEventListener('DOMContentLoaded',sync,{once:true});
  window.addEventListener('load',sync,{once:true});
})();
