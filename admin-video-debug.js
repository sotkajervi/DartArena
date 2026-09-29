(()=>{
  const panel=document.getElementById('webrtcDebug');
  if(!panel)return;
  panel.hidden=true;
  panel.style.display='none';
  const boot=async()=>{
    try{
      if(typeof db==='undefined')return;
      const{data:{session}}=await db.auth.getSession();
      if(!session?.user)return;
      const{data:roles,error}=await db.rpc('get_public_user_roles');
      if(error)return;
      const mine=(roles||[]).find(r=>r.user_id===session.user.id);
      if(mine?.role!=='admin')return;
      const host=document.querySelector('.match-info');
      if(!host)return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='outline wide';
      btn.style.marginTop='10px';
      btn.textContent='Vis video-debug';
      btn.onclick=()=>{
        const show=panel.style.display==='none';
        panel.hidden=!show;
        panel.style.display=show?'block':'none';
        btn.textContent=show?'Skjul video-debug':'Vis video-debug';
      };
      host.appendChild(btn);
    }catch(e){console.warn('Admin video-debug kunne ikke initialiseres',e)}
  };
  boot();
})();
