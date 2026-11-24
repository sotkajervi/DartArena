(()=>{
  if(window.__dartArenaAdminErrorLog||!window.supabase)return;
  window.__dartArenaAdminErrorLog=true;
  const db=(window.DartArenaSupabaseClient||(window.DartArenaSupabaseClient=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK')));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let box=null;
  const date=t=>new Date(t).toLocaleString('nb-NO');
  function classify(message){
    if(/^X01 score: invalid_(score|checkout)(?:\s|$)/.test(message))return 'input';
    if(/^X01 score: (stale_server_state|entry_invalidated|stale_input|turn_not_current|checkout_state_changed)(?:\s|$)/.test(message))return 'sync';
    return 'system';
  }
  function groupRows(rows){
    const groups=new Map();
    for(const r of rows){
      const key=JSON.stringify([r.user_id||r.username||'',r.match_id||'',r.page||'',r.message||'']);
      let g=groups.get(key);
      if(!g){g={...r,count:0,first:r.created_at,last:r.created_at,events:[],type:classify(r.message||'')};groups.set(key,g)}
      g.count++;g.events.push(r);
      if(Date.parse(r.created_at)<Date.parse(g.first))g.first=r.created_at;
      if(Date.parse(r.created_at)>Date.parse(g.last))g.last=r.created_at;
    }
    return [...groups.values()].sort((a,b)=>Date.parse(b.last)-Date.parse(a.last));
  }
  function renderRows(list,rows,filter){
    const groups=groupRows(rows),visible=groups.filter(g=>filter==='all'||g.type===filter);
    const labels={system:'System / nettverk',sync:'Synkronisering',input:'Brukerinput'};
    const colors={system:'#ffb2b7',sync:'#e5bf75',input:'#9cb4b8'};
    list.innerHTML='<div class="muted" style="margin:0 0 12px">'+rows.length+' registreringer · '+groups.length+' grupper (siste 100 registreringer)</div>'+
      (visible.length?visible.map(g=>`<div style="padding:12px;border:1px solid var(--line);border-radius:10px;background:#091416;margin:0 0 8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong>${esc(g.username||'Ukjent')} • ${esc(g.page)}</strong><span style="color:${colors[g.type]};font-size:12px;font-weight:800">${labels[g.type]} · ×${g.count}</span></div>
      <div style="margin:7px 0;color:${colors[g.type]};overflow-wrap:anywhere">${esc(g.message)}</div><small>Siste: ${esc(date(g.last))}${g.count>1?' · Første: '+esc(date(g.first)):''}</small>
      <details style="margin-top:8px"><summary style="cursor:pointer;color:#9cb4b8;font-size:12px">Detaljer og registreringer</summary>
      <div class="muted" style="font-size:11px;overflow-wrap:anywhere;margin:6px 0">Kamp-ID: ${esc(g.match_id||'–')} · Kilde: ${esc(g.source||'–')}</div>
      ${g.events.map(e=>'<div class="muted" style="font-size:11px;padding:3px 0">'+esc(date(e.created_at))+'</div>').join('')}</details></div>`).join(''):'<p class="muted">Ingen registreringer i denne kategorien.</p>');
  }
  async function load(){
    const list=box.querySelector('[data-list]'),filters=box.querySelector('[data-error-filters]');
    list.innerHTML='<p class="muted">Laster…</p>';
    const {data,error}=await db.rpc('admin_recent_client_errors',{p_limit:100});
    if(error){list.textContent=error.message;return}
    const rows=data||[];
    filters.replaceChildren(...[['all','Alle'],['system','System / nettverk'],['sync','Synkronisering'],['input','Brukerinput']].map(([id,label])=>{
      const b=document.createElement('button');b.type='button';b.className='outline';b.textContent=label;b.setAttribute('aria-pressed',String(id==='all'));
      b.onclick=()=>{for(const item of filters.children)item.setAttribute('aria-pressed',String(item===b));renderRows(list,rows,id)};
      return b;
    }));
    renderRows(list,rows,'all');
  }
  function modal(){
    if(box)return box;
    box=document.createElement('div');box.className='modal hidden';
    box.innerHTML='<div class="modal-backdrop" data-close></div><section class="card challenge-modal-card" style="width:min(850px,96vw);max-height:84vh;overflow:auto"><div class="heading"><div><small>ADMIN</small><h2>Feillogg</h2></div><button class="outline" data-close>Lukk</button></div><div data-error-filters style="display:flex;gap:7px;flex-wrap:wrap;margin:12px 0"></div><style>[data-error-filters] button[aria-pressed=true]{border-color:#00eaf4;color:#00eaf4;background:#103338}</style><div data-list></div></section>';
    document.body.appendChild(box);box.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>box.classList.add('hidden'));return box;
  }
  async function boot(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const {data:isAdmin}=await db.rpc('is_admin');if(!isAdmin)return;
    const host=document.getElementById('lobbyStatsActions');if(!host)return;
    const btn=document.createElement('button');btn.id='adminErrorLogBtn';btn.className='small-btn lobby-utility-btn';btn.innerHTML='<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="17" height="17" style="vertical-align:-3px;margin-right:5px;fill:none;stroke:#00eaf4;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M12 11v4M12 18h.01"/></svg><span>Feillogg</span>';btn.onclick=()=>{modal().classList.remove('hidden');load()};host.appendChild(btn);
  }
  boot().catch(()=>{});
})();
