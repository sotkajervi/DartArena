// DartArena cup bracket: builds an NDF-style seeded knockout bracket from completed groups.
(function(){
  const $=id=>document.getElementById(id);
  const done=m=>['finished','wo'].includes(m.status);
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  function nextPow2(n){let x=1;while(x<n)x*=2;return x}

  // Standard bracket seed order used by the NDF cup sheet.
  // 16: 1-16, 9-8, 5-12, 13-4, 3-14, 11-6, 7-10, 15-2.
  function seedOrder(size){let a=[1,2];while(a.length<size){const n=a.length*2,out=[];for(const x of a)out.push(x,n+1-x);a=out}return a.slice(0,size)}

  // Exact top-to-bottom slot maps from the two uploaded NDF playoff sheets.
  // Labels are placement + pool, e.g. 1P1 = no. 1 in pool 1.
  const NDF_SLOTS={
    '2:16':['1P1','8P2','5P1','4P2','3P1','6P2','7P1','2P2','2P1','7P2','6P1','3P2','4P1','5P2','8P1','1P2'],
    '2:32':['1P1','16P2','9P1','8P2','5P1','12P2','13P1','4P2','3P1','14P2','11P1','6P2','7P1','10P2','15P1','2P2','2P1','15P2','10P1','7P2','6P1','11P2','14P1','3P2','4P1','13P2','12P1','5P2','8P1','9P2','16P1','1P2'],
    '4:16':['1P1','4P3','3P2','2P4','2P3','3P1','4P4','1P2','1P3','4P1','3P4','2P2','2P1','3P3','4P2','1P4'],
    '4:8':['1P1','2P4','2P3','1P2','1P3','2P2','2P1','1P4'],
    '8:32':['1P1','4P7','3P4','2P6','2P5','3P3','4P8','1P2','1P3','4P5','3P2','2P8','2P7','3P1','4P6','1P4','1P5','4P3','3P8','2P2','2P1','3P7','4P4','1P6','1P7','4P1','3P6','2P4','2P3','3P5','4P2','1P8'],
    '8:16':['1P1','2P6','2P5','1P2','1P3','2P8','2P7','1P4','1P5','2P2','2P1','1P6','1P7','2P4','2P3','1P8'],
    '16:32':['1P1','2P15','2P16','1P2','1P3','2P13','2P14','1P4','1P5','2P11','2P12','1P6','1P7','2P9','2P10','1P8','1P9','2P7','2P8','1P10','1P11','2P5','2P6','1P12','1P13','2P3','2P4','1P14','1P15','2P1','2P2','1P16']
  };

  function ndfSeededSlots(q,size){
    const groupCount=Math.max(0,...q.map(p=>Number(p.group)||0));
    const template=NDF_SLOTS[`${groupCount}:${size}`];
    if(!template)return null;
    const byLabel=new Map(q.map(p=>[p.seedLabel||`${p.pos}P${p.group}`,p]));
    const slots=template.map(label=>byLabel.get(label)||null);
    return slots.filter(Boolean).length===q.length?slots:null;
  }

  function seededSlots(q,size){
    const ndf=ndfSeededSlots(q,size);if(ndf)return ndf;
    const seeded=[...q].sort((a,b)=>a.pos-b.pos||a.group-b.group).map((p,i)=>({...p,seedNo:i+1,seedLabel:p.seedLabel||`${p.pos}P${p.group}`}));
    const bySeed=new Map(seeded.map(p=>[p.seedNo,p]));
    return seedOrder(size).map(seed=>bySeed.get(seed)||null);
  }

  function cupRoundName(round,total){const left=total/(2**(round-1));if(left===2)return 'Finale';if(left===4)return 'Semifinale';if(left===8)return 'Kvartfinale';if(left===16)return 'Åttedelsfinale';if(left===32)return '1/16-finale';return `Runde ${round}`}
  async function data(){
    const [{data:groups},{data:players},{data:gm},{data:cm}]=await Promise.all([
      db.from('tournament_groups').select('*').eq('tournament_id',id).order('group_no'),
      db.from('tournament_group_players').select('*').eq('tournament_id',id),
      db.from('tournament_matches').select('*').eq('tournament_id',id).eq('stage','group'),
      db.from('tournament_matches').select('*').eq('tournament_id',id).eq('stage','cup').order('round_no').order('match_no')
    ]);return{groups:groups||[],players:players||[],gm:gm||[],cm:cm||[]}
  }
  function qualifiers(d){
    const out=[];for(const g of d.groups){const gp=d.players.filter(p=>p.group_id===g.id),matches=d.gm.filter(m=>m.group_id===g.id),table=standings(gp,matches),n=g.advance_mode==='all'?table.length:Number(g.advance_count||0);table.slice(0,n).forEach((p,i)=>out.push({id:p.id,group:g.group_no,pos:i+1,seedLabel:`${i+1}P${g.group_no}`}))}return out
  }
  async function buildCup(){
    if(tournament.owner_id!==me)return;const d=await data();if(d.cm.length)return alert('Cupen er allerede opprettet.');if(!d.gm.length||d.gm.some(m=>!done(m)))return alert('Alle puljekampene må være ferdige før cupen kan opprettes.');
    const q=qualifiers(d);if(q.length<2)return alert('Minst to spillere må gå videre til cup.');
    const size=nextPow2(q.length),rounds=Math.log2(size),slots=seededSlots(q,size);
    const rows=[];let matchNo=1;for(let i=0;i<size/2;i++){const a=slots[i*2],b=slots[i*2+1];rows.push({tournament_id:id,stage:'cup',round_no:1,match_no:matchNo++,player1_id:a?.id||null,player2_id:b?.id||null,best_of:5,status:a&&b?'pending':a||b?'wo':'pending',winner_id:a&&!b?a.id:!a&&b?b.id:null,is_wo:!!(a&&!b||!a&&b)})}
    for(let r=2;r<=rounds;r++){const count=size/(2**r);for(let i=0;i<count;i++)rows.push({tournament_id:id,stage:'cup',round_no:r,match_no:i+1,player1_id:null,player2_id:null,best_of:r===rounds?7:5,status:'pending',is_wo:false})}
    const {error}=await db.from('tournament_matches').insert(rows);if(error)return alert('Kunne ikke opprette cup: '+error.message);const {error:te}=await db.from('tournaments').update({status:'cup',updated_at:new Date().toISOString()}).eq('id',id).eq('owner_id',me);if(te)return alert(te.message);await load();await loadCup();
  }
  async function advanceWinners(matches){
    const rounds=[...new Set(matches.map(m=>m.round_no))].sort((a,b)=>a-b);let changed=false;
    for(const r of rounds.slice(0,-1)){const cur=matches.filter(m=>m.round_no===r).sort((a,b)=>a.match_no-b.match_no),next=matches.filter(m=>m.round_no===r+1).sort((a,b)=>a.match_no-b.match_no);for(let i=0;i<cur.length;i++){const w=cur[i].winner_id;if(!w)continue;const target=next[Math.floor(i/2)];if(!target)continue;const field=i%2===0?'player1_id':'player2_id';if(!target[field]){const {error}=await db.from('tournament_matches').update({[field]:w}).eq('id',target.id);if(!error){target[field]=w;changed=true}}}}
    return changed
  }
  function cupPlayerHtml(playerId,seedById,{bye=false}={}){
    if(!playerId)return bye?'<span class="cup-bye">BYE</span>':'<span class="cup-name muted">Venter</span>';
    const seed=seedById.get(playerId)||'';
    return `${seed?`<span class="cup-seed">${esc(seed)}</span>`:''}<span class="cup-name">${esc(names[playerId]||'Spiller')}</span>`;
  }
  async function finishTournamentIfNeeded(final){
    if(!final?.winner_id||tournament?.status!=='cup'||tournament?.owner_id!==me)return;
    const {error}=await db.from('tournaments').update({status:'finished',updated_at:new Date().toISOString()}).eq('id',id).eq('owner_id',me).eq('status','cup');
    if(error){console.error('Could not archive completed tournament',error);return}
    tournament.status='finished';
    setTimeout(()=>{try{if(typeof load==='function')load()}catch{}},80);
  }
  async function loadCup(){
    if(!tournament||!['cup_setup','cup','finished'].includes(tournament.status))return;const d=await data();const setup=$('cupSetup'),lobby=$('cupLobby');if(!setup||!lobby)return;
    setup.classList.toggle('hidden',tournament.status!=='cup_setup');lobby.classList.toggle('hidden',!['cup','finished'].includes(tournament.status));
    if(tournament.status==='cup_setup'){const allDone=d.gm.length&&d.gm.every(done),q=allDone?qualifiers(d):[];$('cupSetupInfo').textContent=allDone?`${q.length} spillere er klare for sluttspillet. Cupen bruker NDF-oppsett der dette er definert, og viser puljeplassering som 1P1, 2P1 osv.`:'Cupen kan opprettes når alle puljekampene er ferdige.';$('buildCupBtn').disabled=!allDone;return}
    if(!d.cm.length)return;if(await advanceWinners(d.cm)){setTimeout(loadCup,200);return}const ids=[...new Set(d.cm.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))],missing=ids.filter(x=>!names[x]);if(missing.length){const {data:p}=await db.from('profiles').select('id,username').in('id',missing);Object.assign(names,Object.fromEntries((p||[]).map(x=>[x.id,x.username])))}
    const seedById=new Map(qualifiers(d).map(p=>[p.id,p.seedLabel]));
    const max=Math.max(...d.cm.map(m=>m.round_no));$('cupBracket').innerHTML=Array.from({length:max},(_,i)=>i+1).map(r=>`<div class="cup-round"><div class="cup-round-title">${cupRoundName(r,2**max)}</div>${d.cm.filter(m=>m.round_no===r).map(m=>{const score=done(m)&&!m.is_wo?`${m.player1_legs||0}–${m.player2_legs||0}`:m.is_wo?'WO':'vs',aBye=r===1&&m.is_wo&&!m.player1_id,bBye=r===1&&m.is_wo&&!m.player2_id;return `<div class="cup-match" data-match="${m.id}"><div class="cup-player ${m.winner_id===m.player1_id&&m.player1_id?'winner':''}">${cupPlayerHtml(m.player1_id,seedById,{bye:aBye})}</div><div class="cup-score">${score}</div><div class="cup-player ${m.winner_id===m.player2_id&&m.player2_id?'winner':''}">${cupPlayerHtml(m.player2_id,seedById,{bye:bBye})}</div></div>`}).join('')}</div>`).join('');
    const final=d.cm.find(m=>m.round_no===max);$('cupProgress').textContent=final?.winner_id?`Vinner: ${names[final.winner_id]||'Spiller'}`:`${d.cm.filter(done).length} / ${d.cm.length} kamper ferdig`;
    await finishTournamentIfNeeded(final);
  }
  document.addEventListener('click',e=>{if(e.target.closest('#buildCupBtn'))buildCup()});
  window.addEventListener('dartarena:tournament-loaded',loadCup);window.dartArenaLoadCup=loadCup;
  setTimeout(()=>{if(typeof tournament!=='undefined'&&tournament)loadCup()},700);
})();