(()=>{
  if(window.__dartArenaAdminErrorLog||!window.supabase)return;
  window.__dartArenaAdminErrorLog=true;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let box=null;
  async function load(){
    const list=box.querySelector('[data-list]');
    list.innerHTML='<p class="muted">Laster…</p>';
    const {data,error}=await db.rpc('admin_recent_client_errors',{p_limit:100});
    if(error){list.textContent=error.message;return}
    if(!data?.length){list.innerHTML='<p class="muted">Ingen registrerte feil.</p>';return}
    list.innerHTML=data.map(r=>`<div style="padding:10px;border:1px solid var(--line);border-radius:10px;background:#091416"><strong>${esc(r.username||'Ukjent')} • ${esc(r.page)}</strong><div style="margin-top:5px;color:#ffb2b7">${esc(r.message)}</div><small>${esc(new Date(r.created_at).toLocaleString('nb-NO'))}</small></div>`).join('');
  }
  function modal(){
    if(box)return box;
    box=document.createElement('div');box.className='modal hidden';
    box.innerHTML='<div class="modal-backdrop" data-close></div><section class="card challenge-modal-card" style="width:min(850px,96vw);max-height:84vh;overflow:auto"><div class="heading"><div><small>ADMIN</small><h2>Feillogg</h2></div><button class="outline" data-close>Lukk</button></div><div data-list></div></section>';
    document.body.appendChild(box);box.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>box.classList.add('hidden'));return box;
  }
  async function boot(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const {data:isAdmin}=await db.rpc('is_admin');if(!isAdmin)return;
    const host=document.getElementById('lobbyStatsActions');if(!host)return;
    const btn=document.createElement('button');btn.id='adminErrorLogBtn';btn.className='small-btn lobby-utility-btn';btn.textContent='Feillogg';btn.onclick=()=>{modal().classList.remove('hidden');load()};host.appendChild(btn);
  }
  boot().catch(()=>{});
})();
