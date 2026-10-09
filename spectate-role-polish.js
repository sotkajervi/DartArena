(()=>{
  const OWNER='#00eaf4',ADMIN='#ff9f43';

  function ensureStyle(){
    if(document.getElementById('spectate-role-polish-style'))return;
    const style=document.createElement('style');
    style.id='spectate-role-polish-style';
    style.textContent=`
      .spectate-name.da-role-owner,.spectate-player-head.da-role-owner,.spectate-title-name.da-role-owner{color:${OWNER}!important}
      .spectate-name.da-role-admin,.spectate-player-head.da-role-admin,.spectate-title-name.da-role-admin{color:${ADMIN}!important}
      .spectate-name.da-role-owner::after,.spectate-name.da-role-admin::after,
      .spectate-player-head.da-role-owner::after,.spectate-player-head.da-role-admin::after,
      .spectate-title-name.da-role-owner::after,.spectate-title-name.da-role-admin::after{
        display:inline-flex;align-items:center;margin-left:7px;padding:2px 6px;border-radius:999px;
        font-size:9px;font-weight:950;letter-spacing:.08em;vertical-align:2px;line-height:1.25
      }
      .spectate-name.da-role-owner::after,.spectate-player-head.da-role-owner::after,.spectate-title-name.da-role-owner::after{
        content:'OWNER';color:${OWNER};border:1px solid rgba(0,234,244,.5);background:rgba(0,234,244,.09)
      }
      .spectate-name.da-role-admin::after,.spectate-player-head.da-role-admin::after,.spectate-title-name.da-role-admin::after{
        content:'ADMIN';color:${ADMIN};border:1px solid rgba(255,159,67,.5);background:rgba(255,159,67,.09)
      }
    `;
    document.head.appendChild(style);
  }

  function decorate(el,name,roles){
    if(!el||!name)return;
    const role=roles.roleFor(name);
    el.classList.toggle('da-role-owner',role==='owner');
    el.classList.toggle('da-role-admin',role==='admin');
  }

  function apply(p1Arg,p2Arg){
    ensureStyle();
    const roles=window.DartArenaRoleVisuals;
    if(!roles?.roleFor)return false;
    const p1=p1Arg||document.getElementById('spectateName1')?.textContent.trim();
    const p2=p2Arg||document.getElementById('spectateName2')?.textContent.trim();
    if(!p1||!p2||/^Spiller\s+[12]$/i.test(p1)||/^Spiller\s+[12]$/i.test(p2))return false;

    decorate(document.getElementById('spectateName1'),p1,roles);
    decorate(document.getElementById('spectateName2'),p2,roles);
    decorate(document.getElementById('spectatePlayer1'),p1,roles);
    decorate(document.getElementById('spectatePlayer2'),p2,roles);

    const title=document.getElementById('spectateTitle');
    if(title){
      const n1=document.createElement('span');n1.className='spectate-title-name';n1.textContent=p1;
      const n2=document.createElement('span');n2.className='spectate-title-name';n2.textContent=p2;
      decorate(n1,p1,roles);decorate(n2,p2,roles);
      title.replaceChildren(n1,document.createTextNode(' vs '),n2);
    }
    return true;
  }

  window.DartArenaSpectateRolePolish={apply};
  [0,150,400,800,1400,2400,4000].forEach(delay=>setTimeout(()=>apply(),delay));
})();