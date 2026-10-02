(()=>{
  const OWNER='#23e2d1',ADMIN='#ff9f43';

  function ensureStyle(){
    if(document.getElementById('spectate-role-polish-style'))return;
    const style=document.createElement('style');
    style.id='spectate-role-polish-style';
    style.textContent=`
      .spectate-name.da-role-owner,.spectate-player-head.da-role-owner{color:${OWNER}!important}
      .spectate-name.da-role-admin,.spectate-player-head.da-role-admin{color:${ADMIN}!important}
      .spectate-name.da-role-owner::after,.spectate-name.da-role-admin::after,
      .spectate-player-head.da-role-owner::after,.spectate-player-head.da-role-admin::after{
        display:inline-flex;align-items:center;margin-left:7px;padding:2px 6px;border-radius:999px;
        font-size:9px;font-weight:950;letter-spacing:.08em;vertical-align:2px;line-height:1.25
      }
      .spectate-name.da-role-owner::after,.spectate-player-head.da-role-owner::after{
        content:'OWNER';color:${OWNER};border:1px solid rgba(35,226,209,.5);background:rgba(35,226,209,.09)
      }
      .spectate-name.da-role-admin::after,.spectate-player-head.da-role-admin::after{
        content:'ADMIN';color:${ADMIN};border:1px solid rgba(255,159,67,.5);background:rgba(255,159,67,.09)
      }
    `;
    document.head.appendChild(style);
  }

  function apply(){
    ensureStyle();
    const roles=window.DartArenaRoleVisuals;
    if(!roles?.roleFor)return false;
    let ready=false;
    document.querySelectorAll('.spectate-name,.spectate-player-head').forEach(el=>{
      const name=el.textContent.trim();
      if(!name||/^Spiller\s+[12]$/i.test(name))return;
      ready=true;
      const role=roles.roleFor(name);
      el.classList.toggle('da-role-owner',role==='owner');
      el.classList.toggle('da-role-admin',role==='admin');
    });
    return ready;
  }

  window.DartArenaSpectateRolePolish={apply};
  [0,150,400,800,1400,2400,4000].forEach(delay=>setTimeout(apply,delay));
})();