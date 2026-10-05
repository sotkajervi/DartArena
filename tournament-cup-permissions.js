(()=>{
  if(!window.supabase||window.__dartArenaCupPermissions)return;
  window.__dartArenaCupPermissions=true;

  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId)return;

  const gateDb=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const BEST_OF_OPTIONS=Array.from({length:10},(_,i)=>i*2+3);
  const NDF_SLOTS={
    '2:16':['1P1','8P2','5P1','4P2','3P1','6P2','7P1','2P2','2P1','7P2','6P1','3P2','4P1','5P2','8P1','1P2'],
    '2:32':['1P1','16P2','9P1','8P2','5P1','12P2','13P1','4P2','3P1','14P2','11P1','6P2','7P1','10P2','15P1','2P2','2P1','15P2','10P1','7P2','6P1','11P2','14P1','3P2','4P1','13P2','12P1','5P2','8P1','9P2','16P1','1P2'],
    '4:16':['1P1','4P3','3P2','2P4','2P3','3P1','4P4','1P2','1P3','4P1','3P4','2P2','2P1','3P3','4P2','1P4'],
    '4:8':['1P1','2P4','2P3','1P2','1P3','2P2','2P1','1P4'],
    '8:32':['1P1','4P7','3P4','2P6','2P5','3P3','4P8','1P2','1P3','4P5','3P2','2P8','2P7','3P1','4P6','1P4','1P5','4P3','3P8','2P2','2P1','3P7','4P4','1P6','1P7','4P1','3P6','2P4','2P3','3P5','4P2','1P8'],
    '8:16':['1P1','2P6','2P5','1P2','1P3','2P8','2P7','1P4','1P5','2P2','2P1','1P6','1P7','2P4','2P3','1P8'],
    '16:32':['1P1','2P15','2P16','1P2','1P3','2P13','2P14','1P4','1P5','2P11','2P12','1P6','1P7','2P9','2P10','1P8','1P9','2P7','2P8','1P10','1P11','2P5','2P6','1P12','1P13','2P3','2P4','1P14','1P15','2P1','2P2','1P16']
  };

  let userId=null;
  let tournamentRow=null;
  let canManage=false;
  let ready=false;
  let building=false;
  let reviewing=false;
  let syncBusy=false;
  let syncQueued=false;
  let observer=null;
  let channel=null;

  function ensureStyles(){
    if(document.getElementById('dartarena-cup-permission-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-cup-permission-style';
    style.textContent=`
      html.da-cup-setup-denied #cupSetup{display:none!important}
      .cup-manager-note{margin:8px 0 0;color:var(--muted);font-size:12px}
      .da-cup-review-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(2,8,10,.82);backdrop-filter:blur(7px);padding:18px}
      .da-cup-review-card{width:min(560px,100%);max-height:min(720px,calc(100vh - 36px));overflow:auto;background:linear-gradient(155deg,#12282b,#081416 72%);border:1px solid rgba(35,226,209,.48);box-shadow:0 28px 100px #000c,0 0 28px rgba(35,226,209,.08);border-radius:20px;padding:24px;color:var(--text)}
      .da-cup-review-card h2{margin:5px 0 8px;font-size:24px}.da-cup-review-card p{margin:0 0 18px;color:var(--muted);font-size:13px;line-height:1.6}
      .da-cup-review-grid{display:grid;gap:10px}
      .da-cup-review-round{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.11);background:rgba(0,0,0,.18);border-radius:12px}
      .da-cup-review-round strong{display:block;font-size:14px}.da-cup-review-round small{display:block;color:var(--muted);font-size:11px;letter-spacing:0;margin-top:4px}
      .da-cup-review-round select{width:112px;flex:0 0 auto;background:#091c1e;color:#f2f7f7;border:1px solid #306d6d;border-radius:9px;padding:10px;font-weight:900;font-size:15px}
      .da-cup-review-round select:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
      .da-cup-review-warning{font-size:12px;color:#e8c98b;border:1px solid rgba(244,196,93,.28);background:rgba(244,196,93,.06);border-radius:10px;padding:11px;margin:15px 0}
      .da-cup-review-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}
      .da-cup-review-actions button{min-width:125px}
      @media(max-width:520px){.da-cup-review-card{padding:18px}.da-cup-review-actions button{flex:1}.da-cup-review-round{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function isLeader(){return !!tournamentRow&&!!userId&&tournamentRow.owner_id===userId}
  function isSimulation(){try{return !!simulation}catch{return false}}
  function nextPow2(n){let x=1;while(x<n)x*=2;return x}
  function validBestOf(n){n=Number(n);return Number.isInteger(n)&&n>=3&&n<=21&&n%2===1}
  function defaultFormats(rounds){const out={};for(let r=1;r<=rounds;r++)out[r]=r===rounds?7:5;return out}
  function roundName(round,totalRounds){const players=2**(totalRounds-round+1);if(players===2)return'Finale';if(players===4)return'Semifinale';if(players===8)return'Kvartfinale';if(players===16)return'Åttedelsfinale';if(players===32)return'1/16-finale';return`Runde ${round}`}
  function cupRoundName(round,total){const left=total/(2**(round-1));if(left===2)return'Finale';if(left===4)return'Semifinale';if(left===8)return'Kvartfinale';if(left===16)return'Åttedelsfinale';if(left===32)return'1/16-finale';return`Runde ${round}`}
  function optionHtml(selected){return BEST_OF_OPTIONS.map(n=>`<option value="${n}" ${n===selected?'selected':''}>Bo${n}</option>`).join('')}

  async function refreshPermission(){
    const {data:{session}}=await gateDb.auth.getSession();
    if(!session?.user){ready=true;canManage=false;applyGate();return}
    userId=session.user.id;
    const [tResult,adminResult]=await Promise.all([
      gateDb.from('tournaments').select('id,owner_id,status,tournament_type,game').eq('id',tournamentId).maybeSingle(),
      gateDb.rpc('is_admin')
    ]);
    if(tResult.error)throw tResult.error;
    tournamentRow=tResult.data||null;
    canManage=!!tournamentRow&&(tournamentRow.owner_id===userId||adminResult.data===true);
    ready=true;
    window.DartArenaTournamentCupCanManage=canManage;
    applyGate();
  }

  function applyGate(){
    ensureStyles();
    document.documentElement.classList.toggle('da-cup-setup-denied',ready&&!canManage);
    document.documentElement.classList.toggle('da-cup-setup-manager',ready&&canManage);
  }

  function scheduleSync(delay=70){
    if(syncQueued)return;
    syncQueued=true;
    setTimeout(()=>{
      syncQueued=false;
      syncUi().catch(error=>console.warn('Cup permission UI sync failed',error));
    },delay);
  }

  async function syncUi(){
    if(syncBusy)return;
    syncBusy=true;
    try{
      await refreshPermission();
      if(!tournamentRow||tournamentRow.status!=='cup_setup')return;
      if(!canManage){
        document.getElementById('cupFormatSettings')?.remove();
        document.getElementById('pureCupFormatSettings')?.remove();
        document.getElementById('tournamentGameField')?.remove();
        return;
      }
      if(!isLeader())await ensureAdminGameSelector();
      if(!isLeader()&&tournamentRow.tournament_type==='groups_cup')await ensureAdminGroupCupFormat();
    }finally{
      syncBusy=false;
    }
  }

  async function ensureAdminGameSelector(){
    const btn=document.getElementById('buildCupBtn');
    if(!btn||tournamentRow?.status!=='cup_setup')return;
    let field=document.getElementById('tournamentGameField');
    if(!field){
      field=document.createElement('label');
      field.id='tournamentGameField';
      field.className='field';
      field.dataset.cupPermissionManager='1';
      field.innerHTML='<span>Spill</span><select id="tournamentGame"><option value="170">170</option><option value="301">301</option><option value="501">501</option><option value="1001">1001</option></select>';
      btn.insertAdjacentElement('beforebegin',field);
    }
    const select=field.querySelector('#tournamentGame');
    if(!select)return;
    select.value=String([170,301,501,1001].includes(Number(tournamentRow.game))?Number(tournamentRow.game):501);
    if(select.dataset.cupPermissionBound==='1')return;
    select.dataset.cupPermissionBound='1';
    select.addEventListener('change',async()=>{
      const game=Number(select.value);
      if(![170,301,501,1001].includes(game))return;
      const previous=Number(tournamentRow.game)||501;
      select.disabled=true;
      try{
        const {error}=await gateDb.from('tournaments')
          .update({game,updated_at:new Date().toISOString()})
          .eq('id',tournamentId)
          .eq('status','cup_setup');
        if(error)throw error;
        tournamentRow.game=game;
        try{if(typeof tournament!=='undefined'&&tournament)tournament.game=game}catch{}
        try{if(typeof tournamentMeta==='function'&&typeof tournament!=='undefined'&&tournament)document.getElementById('tMeta').textContent=tournamentMeta(tournament)}catch{}
      }catch(error){
        select.value=String(previous);
        alert('Kunne ikke lagre spillvalg: '+(error.message||error));
      }finally{select.disabled=false}
    });
  }

  function makeStandings(players,matches,nameMap){
    const s=Object.fromEntries(players.map(p=>[p.user_id,{id:p.user_id,w:0,lf:0,la:0,d:0}]));
    matches.filter(m=>['finished','wo'].includes(m.status)).forEach(m=>{
      if(!s[m.player1_id]||!s[m.player2_id])return;
      const a=Number(m.player1_legs||0),b=Number(m.player2_legs||0);
      s[m.player1_id].lf+=a;s[m.player1_id].la+=b;
      s[m.player2_id].lf+=b;s[m.player2_id].la+=a;
      if(m.winner_id&&s[m.winner_id])s[m.winner_id].w++;
    });
    Object.values(s).forEach(x=>x.d=x.lf-x.la);
    const h2h=(a,b)=>{
      const m=matches.find(x=>['finished','wo'].includes(x.status)&&((x.player1_id===a&&x.player2_id===b)||(x.player1_id===b&&x.player2_id===a)));
      if(!m?.winner_id)return 0;
      return m.winner_id===a?-1:m.winner_id===b?1:0;
    };
    return Object.values(s).sort((a,b)=>b.w-a.w||b.d-a.d||b.lf-a.lf||h2h(a.id,b.id)||String(nameMap[a.id]||'').localeCompare(String(nameMap[b.id]||''),'nb'));
  }

  async function groupCupData(){
    const [{data:groups,error:ge},{data:players,error:pe},{data:gm,error:gme},{data:cm,error:cme}]=await Promise.all([
      gateDb.from('tournament_groups').select('*').eq('tournament_id',tournamentId).order('group_no'),
      gateDb.from('tournament_group_players').select('*').eq('tournament_id',tournamentId),
      gateDb.from('tournament_matches').select('*').eq('tournament_id',tournamentId).eq('stage','group'),
      gateDb.from('tournament_matches').select('*').eq('tournament_id',tournamentId).eq('stage','cup').order('round_no').order('match_no')
    ]);
    const error=ge||pe||gme||cme;if(error)throw error;
    const ids=[...new Set((players||[]).map(p=>p.user_id).filter(Boolean))];
    let nameMap={};
    if(ids.length){
      const {data:profiles,error}=await gateDb.from('profiles').select('id,username').in('id',ids);
      if(error)throw error;
      nameMap=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
    }
    return{groups:groups||[],players:players||[],gm:gm||[],cm:cm||[],nameMap};
  }

  function qualifiers(d){
    const out=[];
    for(const g of d.groups){
      const gp=d.players.filter(p=>p.group_id===g.id);
      const matches=d.gm.filter(m=>m.group_id===g.id);
      const table=makeStandings(gp,matches,d.nameMap);
      const n=g.advance_mode==='all'?table.length:Number(g.advance_count||0);
      table.slice(0,n).forEach((p,i)=>out.push({id:p.id,group:g.group_no,pos:i+1,seedLabel:`${i+1}P${g.group_no}`}));
    }
    return out;
  }

  function seedOrder(size){let a=[1,2];while(a.length<size){const n=a.length*2,out=[];for(const x of a)out.push(x,n+1-x);a=out}return a.slice(0,size)}
  function seededSlots(q,size){
    const groupCount=Math.max(0,...q.map(p=>Number(p.group)||0));
    const template=NDF_SLOTS[`${groupCount}:${size}`];
    if(template){
      const byLabel=new Map(q.map(p=>[p.seedLabel||`${p.pos}P${p.group}`,p]));
      const slots=template.map(label=>byLabel.get(label)||null);
      if(slots.filter(Boolean).length===q.length)return slots;
    }
    const seeded=[...q].sort((a,b)=>a.pos-b.pos||a.group-b.group).map((p,i)=>({...p,seedNo:i+1}));
    const bySeed=new Map(seeded.map(p=>[p.seedNo,p]));
    return seedOrder(size).map(seed=>bySeed.get(seed)||null);
  }

  async function ensureAdminGroupCupFormat(){
    const btn=document.getElementById('buildCupBtn');
    if(!btn)return;
    const d=await groupCupData();
    const allDone=d.gm.length>0&&d.gm.every(m=>['finished','wo'].includes(m.status));
    const q=allDone?qualifiers(d):[];
    btn.disabled=!allDone||q.length<2;
    if(!allDone||q.length<2){document.getElementById('cupFormatSettings')?.remove();return}
    const size=nextPow2(q.length),rounds=Math.log2(size),defaults=defaultFormats(rounds);
    let box=document.getElementById('cupFormatSettings');
    if(!box){
      box=document.createElement('div');
      box.id='cupFormatSettings';
      box.dataset.cupPermissionManager='1';
      box.style.cssText='margin:10px 0 12px;padding:10px 12px;border:1px solid rgba(35,226,209,.25);border-radius:12px;background:rgba(9,20,22,.72)';
      btn.insertAdjacentElement('beforebegin',box);
    }
    if(box.dataset.cupPermissionRendered===String(rounds))return;
    box.dataset.cupPermissionRendered=String(rounds);
    box.innerHTML=`<div style="display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap"><div style="min-width:145px;margin-right:2px"><small>KAMPFORMAT</small><div style="font-weight:900;font-size:14px;margin-top:3px">Best of per runde</div></div>${Array.from({length:rounds},(_,i)=>i+1).map(r=>`<label class="field" style="margin:0;min-width:112px;flex:1 1 112px"><span style="display:block;font-size:10px;font-weight:800;margin-bottom:3px">${cupRoundName(r,size)}</span><select data-cup-round="${r}" style="margin-top:0;padding:8px 10px">${optionHtml(defaults[r])}</select></label>`).join('')}</div>`;
  }

  function selectedGroupFormats(rounds){
    const out=defaultFormats(rounds);
    document.querySelectorAll('#cupFormatSettings select[data-cup-round]').forEach(s=>{const r=Number(s.dataset.cupRound),n=Number(s.value);if(r&&validBestOf(n))out[r]=n});
    return out;
  }

  function selectedPureFormats(rounds){
    const out=defaultFormats(rounds);
    document.querySelectorAll('#pureCupFormatSettings select[data-pure-cup-round]').forEach(s=>{const r=Number(s.dataset.pureCupRound),n=Number(s.value);if(r&&validBestOf(n))out[r]=n});
    return out;
  }

  function shuffle3(list){
    let out=[...list];
    for(let pass=0;pass<3;pass++)for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
    return out;
  }

  function distributedSlots(shuffled,size){
    const matchCount=size/2,byeCount=size-shuffled.length,byeMatches=new Set();
    if(byeCount>0)for(let i=0;i<byeCount;i++)byeMatches.add(Math.floor(((i+.5)*matchCount)/byeCount));
    const slots=[];let p=0;
    for(let match=0;match<matchCount;match++){
      if(byeMatches.has(match)){
        const player=shuffled[p++]||null;
        if(match%2===0)slots.push(player,null);else slots.push(null,player);
      }else slots.push(shuffled[p++]||null,shuffled[p++]||null);
    }
    return slots;
  }

  async function buildGroupsCup(approvedFormats){
    const d=await groupCupData();
    if(d.cm.length)throw new Error('Cupen er allerede opprettet.');
    if(!d.gm.length||d.gm.some(m=>!['finished','wo'].includes(m.status)))throw new Error('Alle puljekampene må være ferdige før cupen kan opprettes.');
    const q=qualifiers(d);if(q.length<2)throw new Error('Minst to spillere må gå videre til cup.');
    const size=nextPow2(q.length),rounds=Math.log2(size),slots=seededSlots(q,size),formats=approvedFormats||selectedGroupFormats(rounds),rows=[];
    if(Array.from({length:rounds},(_,i)=>i+1).some(round=>!validBestOf(formats[round])))throw new Error('Ugyldig Best of for cuprunde.');
    let matchNo=1;
    for(let i=0;i<size/2;i++){
      const a=slots[i*2],b=slots[i*2+1];
      rows.push({tournament_id:tournamentId,stage:'cup',round_no:1,match_no:matchNo++,player1_id:a?.id||null,player2_id:b?.id||null,best_of:formats[1],status:a&&b?'pending':a||b?'wo':'pending',winner_id:a&&!b?a.id:!a&&b?b.id:null,is_wo:!!(a&&!b||!a&&b)});
    }
    for(let r=2;r<=rounds;r++)for(let i=0;i<size/(2**r);i++)rows.push({tournament_id:tournamentId,stage:'cup',round_no:r,match_no:i+1,player1_id:null,player2_id:null,best_of:formats[r],status:'pending',is_wo:false});
    const {error}=await gateDb.from('tournament_matches').insert(rows);if(error)throw error;
  }

  async function buildPureCup(approvedFormats){
    const [{data:members,error:me},{data:existing,error:ee}]=await Promise.all([
      gateDb.from('tournament_members').select('user_id,role,joined_at').eq('tournament_id',tournamentId).eq('role','participant').order('joined_at'),
      gateDb.from('tournament_matches').select('id').eq('tournament_id',tournamentId).eq('stage','cup').limit(1)
    ]);
    if(me)throw me;if(ee)throw ee;if(existing?.length)throw new Error('Cupen er allerede opprettet.');
    const players=(members||[]).map(m=>({id:m.user_id}));
    if(players.length<2)throw new Error('Minst to spillere må være med i cupen.');
    const size=nextPow2(players.length),rounds=Math.log2(size),formats=approvedFormats||selectedPureFormats(rounds),slots=distributedSlots(shuffle3(players),size),rows=[];
    if(Array.from({length:rounds},(_,i)=>i+1).some(round=>!validBestOf(formats[round])))throw new Error('Ugyldig Best of for cuprunde.');
    for(let i=0;i<size/2;i++){
      const a=slots[i*2],b=slots[i*2+1];
      rows.push({tournament_id:tournamentId,stage:'cup',round_no:1,match_no:i+1,player1_id:a?.id||null,player2_id:b?.id||null,best_of:formats[1],status:a&&b?'pending':a||b?'wo':'pending',winner_id:a&&!b?a.id:!a&&b?b.id:null,is_wo:!!(a&&!b||!a&&b)});
    }
    for(let r=2;r<=rounds;r++)for(let i=0;i<size/(2**r);i++)rows.push({tournament_id:tournamentId,stage:'cup',round_no:r,match_no:i+1,player1_id:null,player2_id:null,best_of:formats[r],status:'pending',is_wo:false});
    const {error}=await gateDb.from('tournament_matches').insert(rows);if(error)throw error;
  }

  async function confirmCupFormats(){
    const pure=tournamentRow?.tournament_type==='cup';
    const attribute=pure?'pureCupRound':'cupRound';
    const selector=pure?'#pureCupFormatSettings select[data-pure-cup-round]':'#cupFormatSettings select[data-cup-round]';
    const fields=[...document.querySelectorAll(selector)].sort((a,b)=>Number(a.dataset[attribute])-Number(b.dataset[attribute]));
    if(!fields.length)throw new Error('Fant ingen cuprunder. Vent til cupoppsettet er lastet og prøv igjen.');
    if(fields.some((field,i)=>Number(field.dataset[attribute])!==i+1||!validBestOf(field.value)))throw new Error('Best of-oppsettet er ugyldig. Oppdater cupoppsettet og prøv igjen.');

    const overlay=document.createElement('div');
    overlay.className='da-cup-review-overlay';
    const card=document.createElement('section');
    card.className='da-cup-review-card';
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','true');
    card.setAttribute('aria-labelledby','daCupReviewTitle');
    card.innerHTML=`<small>KONTROLLER KAMPFORMAT</small>
      <h2 id="daCupReviewTitle">Klar for cup? 🎯</h2>
      <p>Se over antall legs per cuprunde. Du kan endre Best of her før du bekrefter oppstart.</p>
      <div class="da-cup-review-grid">${fields.map((field,i)=>`<label class="da-cup-review-round">
        <span><strong>${roundName(i+1,fields.length)}</strong><small data-cup-legs-hint>Først til ${(Number(field.value)+1)/2} legs</small></span>
        <select data-review-round="${i+1}" aria-label="Best of ${roundName(i+1,fields.length)}">${optionHtml(Number(field.value))}</select>
      </label>`).join('')}</div>
      <div class="da-cup-review-warning">Etter at cupen er opprettet, er kampformatet låst. Kontroller spesielt finalen.</div>
      <div class="da-cup-review-actions"><button type="button" class="outline" data-cup-cancel>Tilbake og rediger</button><button type="button" class="primary" data-cup-confirm>Bekreft og start cup</button></div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const focusBefore=document.activeElement;
    const selects=[...card.querySelectorAll('select[data-review-round]')];
    const updateHint=select=>{
      const hint=select.closest('.da-cup-review-round')?.querySelector('[data-cup-legs-hint]');
      if(hint)hint.textContent=`Først til ${(Number(select.value)+1)/2} legs`;
    };
    selects.forEach(select=>select.addEventListener('change',()=>updateHint(select)));
    selects[0]?.focus();

    return new Promise(resolve=>{
      let settled=false;
      function finish(confirmed){
        if(settled)return;
        const approved=confirmed?Object.fromEntries(selects.map((select,i)=>[i+1,Number(select.value)])):null;
        if(approved&&Object.values(approved).some(value=>!validBestOf(value)))return;
        settled=true;
        document.removeEventListener('keydown',onKey,true);
        overlay.remove();
        if(focusBefore?.isConnected)focusBefore.focus();
        if(approved){
          selects.forEach((select,i)=>{
            if(fields[i].isConnected){
              fields[i].value=select.value;
              fields[i].dispatchEvent(new Event('change',{bubbles:true}));
            }
          });
        }
        resolve(approved);
      }
      function onKey(event){
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false)}
        if(event.key==='Tab'){
          const controls=[...card.querySelectorAll('select,button')];
          const first=controls[0],last=controls[controls.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
        }
      }
      document.addEventListener('keydown',onKey,true);
      card.querySelector('[data-cup-cancel]').addEventListener('click',()=>finish(false));
      card.querySelector('[data-cup-confirm]').addEventListener('click',()=>finish(true));
      overlay.addEventListener('click',event=>{if(event.target===overlay)finish(false)});
    });
  }

  async function buildAsPrivileged(approvedFormats){
    if(building)return;
    building=true;
    const btn=document.getElementById('buildCupBtn');
    const old=btn?.textContent||'Opprett cupoppsett';
    if(btn){btn.disabled=true;btn.textContent='Oppretter…'}
    try{
      await refreshPermission();
      if(!canManage)throw new Error('Kun Admin, Owner eller turneringsleder kan sette opp cup.');
      if(!tournamentRow||tournamentRow.status!=='cup_setup')throw new Error('Cupoppsettet er ikke tilgjengelig nå.');
      if(tournamentRow.tournament_type==='groups_cup')await buildGroupsCup(approvedFormats);
      else await buildPureCup(approvedFormats);
      const {error}=await gateDb.from('tournaments')
        .update({status:'cup',updated_at:new Date().toISOString()})
        .eq('id',tournamentId)
        .eq('status','cup_setup');
      if(error)throw error;
      try{await gateDb.rpc('advance_tournament_cup',{p_tournament_id:tournamentId})}catch{}
      await refreshPermission();
      try{if(typeof load==='function')await load()}catch{}
      try{if(typeof window.dartArenaLoadCup==='function')await window.dartArenaLoadCup()}catch{}
    }catch(error){
      alert(error.message||String(error));
      if(btn){btn.disabled=false;btn.textContent=old}
    }finally{building=false}
  }

  document.addEventListener('click',async event=>{
    const btn=event.target.closest?.('#buildCupBtn');
    if(!btn||isSimulation())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(building||reviewing||btn.disabled)return;
    reviewing=true;
    try{
      await refreshPermission();
      if(!canManage)throw new Error('Kun turneringsleder, Admin eller Owner kan starte cup.');
      if(tournamentRow?.status!=='cup_setup')throw new Error('Cupoppsettet kan bare bekreftes før cupen starter.');
      const formats=await confirmCupFormats();
      if(!formats)return;
      await buildAsPrivileged(formats);
    }catch(error){
      const message=error?.message||String(error);
      const dialog=window.DartArenaDialog;
      if(dialog?.alert)await dialog.alert(message,{title:'Kan ikke starte cup',tone:'warning'});
      else alert(message);
    }finally{
      reviewing=false;
    }
  },true);

  async function boot(){
    ensureStyles();
    await refreshPermission();
    scheduleSync(20);
    window.addEventListener('dartarena:tournament-loaded',()=>scheduleSync(120));
    const setup=document.getElementById('cupSetup');
    if(setup){
      observer=new MutationObserver(()=>scheduleSync(100));
      observer.observe(setup,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    channel=gateDb.channel(`cup-permissions-${tournamentId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'tournaments',filter:`id=eq.${tournamentId}`},()=>scheduleSync(80))
      .on('postgres_changes',{event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`},()=>scheduleSync(120))
      .subscribe();
  }

  boot().catch(error=>console.error('Tournament cup permissions init failed',error));
  window.addEventListener('pagehide',()=>{
    observer?.disconnect();
    if(channel){try{gateDb.removeChannel(channel)}catch{}}
  },{once:true});
})();