(()=>{
  if(window.__dartArenaAdminCleanup||!window.supabase)return;
  window.__dartArenaAdminCleanup=true;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let modal=null;

  function gameLabel(r){if(r.game_variant==='jdc')return'JDC';if(r.game_variant==='cricket')return'Cricket';if(r.game_variant==='half_it')return'Half-It';if(r.game_variant==='half_it_standard')return'Half-It Standard';if(r.game_variant==='sixty_one')return'61';return String(r.game||501)}

  async function load(){
    const host=modal?.querySelector('[data-cleanup-list]');if(!host)return;
    host.innerHTML='<p class="muted">Laster aktive kamper…</p>';
    const {data,error}=await db.rpc('admin_list_active_matches');
    if(error){host.innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}
    if(!data?.length){host.innerHTML='<p class="muted">Ingen aktive eller hengende kamper.</p>';return}
    host.innerHTML=data.map(r=>`<article style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:#091416"><div><strong>${esc(r.player1_name)} vs ${esc(r.player2_name)}</strong><div class="muted" style="font-size:12px;margin-top:4px">${esc(gameLabel(r))} • ${esc(r.status)} • ${Number(r.age_minutes||0)} min siden siste oppdatering</div></div><button class="danger" data-admin-cancel="${esc(r.id)}">Avbryt</button></article>`).join('');
    host.querySelectorAll('[data-admin-cancel]').forEach(btn=>btn.onclick=async()=>{
      if(!confirm('Avbryte denne aktive kampen? Bruk dette bare på en hengende/testkamp.'))return;
      btn.disabled=true;btn.textContent='Avbryter…';
      const {error}=await db.rpc('admin_cancel_active_match',{p_match_id:btn.dataset.adminCancel});
      if(error){alert('Kunne ikke avbryte: '+error.message);btn.disabled=false;btn.textContent='Avbryt';return}
      await load();
    });
  }

  function ensureModal(){
    if(modal)return modal;
    modal=document.createElement('div');modal.className='modal hidden';modal.innerHTML='<div class="modal-backdrop" data-cleanup-close></div><section class="card challenge-modal-card" style="width:min(760px,94vw);max-height:82vh;overflow:auto"><div class="heading"><div><small>ADMIN</small><h2>Aktive kamper</h2></div><button class="outline" data-cleanup-close>Lukk</button></div><p class="muted compact">Rydd opp i testkamper eller kamper som har blitt hengende i waiting/playing. Dette avbryter kampen, men sletter ikke historikk.</p><div data-cleanup-list style="display:grid;gap:8px"></div></section>';
    document.body.appendChild(modal);modal.querySelectorAll('[data-cleanup-close]').forEach(el=>el.onclick=()=>modal.classList.add('hidden'));return modal;
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const {data:isAdmin,error}=await db.rpc('is_admin');if(error||!isAdmin)return;
    const host=document.getElementById('lobbyStatsActions')||document.querySelector('#lobbyView .top-actions');if(!host)return;
    if(document.getElementById('adminCleanupBtn'))return;
    const btn=document.createElement('button');btn.id='adminCleanupBtn';btn.type='button';btn.className=host.id==='lobbyStatsActions'?'small-btn lobby-utility-btn':'outline';btn.textContent='Rydd aktive kamper';btn.onclick=()=>{ensureModal().classList.remove('hidden');load()};host.appendChild(btn);
  }
  boot().catch(console.warn);
})();
