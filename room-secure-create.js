(()=>{
  const wait=setInterval(()=>{
    const propose=document.getElementById('proposalBtn');
    const accept=document.getElementById('acceptProposalBtn');
    const reject=document.getElementById('rejectProposalBtn');
    if(!propose||!accept||!reject||!window.supabase||typeof pendingProposal==='undefined'||typeof db==='undefined'||typeof selectedGame!=='function')return;
    clearInterval(wait);
    install(propose,accept,reject);
  },100);

  function resolveVariant(raw){
    if(raw==='chicago')return'x01';
    return window.DartArenaGames?.variantFor?.(raw)||(raw==='cricket'?'cricket':raw==='half_it'||raw==='half_it_standard'?'half_it':raw==='sixty_one'?'sixty_one':raw==='jdc'?'jdc':'x01');
  }
  function labelFor(raw){
    return raw==='chicago'?'Chicago Style':window.DartArenaGames?.labelForRaw?.(raw)||(raw==='half_it_standard'?'Half-It (Standard)':raw==='half_it'?'Half-It (DartCounter)':raw==='cricket'?'Cricket':raw==='sixty_one'?'61':raw==='jdc'?'JDC Challenge':String(raw));
  }
  function halfModeFor(raw){return raw==='half_it_standard'?'standard':raw==='half_it'?'dartcounter':null}

  function ensureOptionStyles(){
    if(document.getElementById('room-match-option-styles'))return;
    const style=document.createElement('style');
    style.id='room-match-option-styles';
    style.textContent=`
      .room-switch-list{display:grid;gap:9px;margin:11px 0 14px}
      .room-switch-option{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 13px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.025);cursor:pointer;user-select:none}
      .room-switch-copy{min-width:0}.room-switch-copy strong{display:block}.room-switch-copy small{display:block;color:var(--muted);margin-top:3px;line-height:1.35}
      .room-switch-control{display:flex;align-items:center;gap:8px;flex:0 0 auto}.room-switch-control input{position:absolute;opacity:0;pointer-events:none}
      .room-switch-track{position:relative;width:48px;height:27px;border-radius:999px;background:#263639;border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 4px rgba(0,0,0,.35);transition:.18s ease}
      .room-switch-track i{position:absolute;width:21px;height:21px;left:2px;top:2px;border-radius:50%;background:#dbe5e5;box-shadow:0 2px 6px rgba(0,0,0,.35);transition:.18s ease}
      .room-switch-control input:checked+.room-switch-track{background:rgba(35,226,209,.26);border-color:rgba(35,226,209,.68);box-shadow:inset 0 0 0 1px rgba(35,226,209,.13),0 0 13px rgba(35,226,209,.08)}
      .room-switch-control input:checked+.room-switch-track i{transform:translateX(21px);background:var(--cyan)}
      .room-switch-control input:focus-visible+.room-switch-track{outline:2px solid var(--cyan);outline-offset:3px}
      .room-switch-state{min-width:24px;font-size:11px;letter-spacing:.06em;color:var(--muted)}
      .room-switch-control input:checked~.room-switch-state{color:var(--cyan)}
      .room-proposal-flags{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 2px}
      .room-proposal-flag{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.14);font-size:10px;font-weight:950;letter-spacing:.07em}
      .room-proposal-flag.live-on{color:var(--cyan);border-color:rgba(35,226,209,.45);background:rgba(35,226,209,.08)}
      .room-proposal-flag.live-off{color:#aab9bb;background:rgba(255,255,255,.035)}
      .room-proposal-flag.warm-on{color:#ffd07a;border-color:rgba(255,190,80,.42);background:rgba(255,190,80,.08)}
      .room-proposal-flag.warm-off{color:#aab9bb;background:rgba(255,255,255,.035)}
      @media(max-width:520px){.room-switch-option{align-items:flex-start}.room-switch-control{padding-top:3px}}
    `;
    document.head.appendChild(style);
  }

  function makeSwitch(id,title,help,checked){
    const label=document.createElement('label');
    label.className='room-switch-option';
    label.innerHTML=`<span class="room-switch-copy"><strong>${title}</strong><small>${help}</small></span><span class="room-switch-control"><input id="${id}" type="checkbox" ${checked?'checked':''}><span class="room-switch-track" aria-hidden="true"><i></i></span><b class="room-switch-state">${checked?'PÅ':'AV'}</b></span>`;
    const input=label.querySelector('input'),state=label.querySelector('.room-switch-state');
    input.addEventListener('change',()=>{state.textContent=input.checked?'PÅ':'AV'});
    return label;
  }

  function ensureOptionUi(){
    ensureOptionStyles();
    if(document.getElementById('roomLive'))return;
    const oldWarm=document.getElementById('roomWarmup');
    const oldLabel=oldWarm?.closest('label');
    if(!oldLabel)return;
    const list=document.createElement('div');
    list.className='room-switch-list';
    list.append(
      makeSwitch('roomLive','Vis kampen live','Tillat at andre kan følge kampen under Pågående kamper / Live nå.',true),
      makeSwitch('roomWarmup','Oppvarmingskamp','Spilles normalt, men teller ikke på AVG, form, historikk, Top 10 eller ranking.',false)
    );
    oldLabel.replaceWith(list);
  }

  function renderProposalFlags(isLive,isWarmup){
    const text=document.getElementById('proposalText');
    if(!text)return;
    let box=document.getElementById('proposalOptionFlags');
    if(!box){box=document.createElement('div');box.id='proposalOptionFlags';box.className='room-proposal-flags';text.insertAdjacentElement('afterend',box)}
    box.innerHTML=`<span class="room-proposal-flag ${isLive?'live-on':'live-off'}">LIVE ${isLive?'PÅ':'AV'}</span><span class="room-proposal-flag ${isWarmup?'warm-on':'warm-off'}">OPPVARMING ${isWarmup?'PÅ':'AV'}</span>`;
  }

  function clearProposalFlags(){document.getElementById('proposalOptionFlags')?.remove()}

  function hookProposalDisplay(){
    if(window.__dartArenaRoomOptionProposalHook||typeof showProposal!=='function')return;
    window.__dartArenaRoomOptionProposalHook=true;
    const base=showProposal;
    showProposal=function(p){
      base(p);
      const isLive=p?.isLive!==false;
      if(pendingProposal){pendingProposal.isLive=isLive;pendingProposal.isWarmup=!!p?.isWarmup}
      renderProposalFlags(isLive,!!p?.isWarmup);
    };
  }

  function install(propose,accept,reject){
    ensureOptionUi();
    hookProposalDisplay();

    propose.onclick=async()=>{
      const raw=selectedGame();
      const chicago=raw==='chicago',variant=chicago?'x01':resolveVariant(raw),special=variant!=='x01'||chicago,half=variant==='half_it',sixty=variant==='sixty_one',jdc=variant==='jdc';
      const legs=chicago?3:jdc?1:Number(document.getElementById('roomLegs').value),mode=special?'legs':matchMode;
      const sets=special?1:(mode==='sets'?Number(document.getElementById('roomSets').value):1);
      const durationMinutes=sixty?Number(document.getElementById('room61Time').value):null;
      const warmup=!!document.getElementById('roomWarmup')?.checked;
      const live=document.getElementById('roomLive')?.checked!==false;
      if(legs<1||legs>21||legs%2===0||sets<1||sets>11||sets%2===0){document.getElementById('roomMessage').textContent='Best of må være et gyldig oddetall.';return}
      if(sixty&&![10,20,30,45,60].includes(durationMinutes)){document.getElementById('roomMessage').textContent='Velg gyldig tid per leg.';return}
      const starterChoice=document.getElementById('roomStarter').value;
      const starterId=starterChoice==='me'?profile.id:starterChoice==='opponent'?other:null;
      const gameConfig=chicago?{chicago:true,chicago_stage:1,ranked:false,chicago_results:[]}:sixty?{duration_seconds:durationMinutes*60}:half?{half_it_mode:halfModeFor(raw)}:jdc?{ranked:!warmup}:{};
      const game=chicago?301:special?501:Number(raw);
      propose.disabled=true;propose.textContent='Sender…';
      try{
        const {data,error}=await db.rpc('propose_challenge_match',{
          p_challenge_id:challengeId,p_game_variant:variant,p_game:game,p_legs:legs,
          p_match_mode:mode,p_best_of_sets:sets,p_starter_id:starterId,p_game_config:gameConfig,
          p_is_warmup:warmup,p_is_live:live
        });
        if(error||!data)throw error||new Error('Forslaget kunne ikke lagres.');
        const serverChicago=String(data.game_config?.chicago??chicago).toLowerCase()==='true';
        const payload={proposalId:data.id,game:raw,gameVariant:variant,isChicago:serverChicago,gameConfig:data.game_config||gameConfig,halfItMode:half?halfModeFor(raw):null,legs:Number(data.legs),sets:Number(data.best_of_sets),mode:data.match_mode,starter:data.starter_id||'random',durationMinutes,isWarmup:!!data.is_warmup,isLive:data.is_live!==false};
        await send('proposal',payload);
        const label=labelFor(raw),prefix=warmup?'Oppvarming • ':'',liveText=live?'Live PÅ':'Live AV';
        const core=chicago
          ?`${prefix}Chicago Style • 301 DI/DO → Cricket → 501 DO`
          :half
          ?`${prefix}${label} • Best of ${legs} legs • 12 runder/leg`
          :sixty?`${prefix}61 • Best of ${legs} legs • ${durationMinutes} min/leg`
          :jdc?`${prefix}JDC Challenge • 57 piler hver${warmup?' • teller ikke på Top 10/tier':' • offisiell online-score'}`
          :mode==='sets'?`${prefix}${label} • Best of ${sets} sets • Best of ${legs} legs`
          :`${prefix}${label} • Best of ${legs} legs`;
        document.getElementById('roomMessage').textContent=`Forslag sendt: ${core} • ${liveText}`;
      }catch(error){document.getElementById('roomMessage').textContent=error?.message||'Forslaget kunne ikke sendes.'}
      finally{propose.disabled=false;propose.textContent='Send kampforslag'}
    };

    accept.onclick=async()=>{
      if(!pendingProposal?.proposalId){document.getElementById('roomMessage').textContent='Forslaget mangler serverbekreftelse. Be motstanderen sende det på nytt.';return}
      accept.disabled=true;accept.textContent='Starter…';
      try{
        const {data:match,error}=await db.rpc('accept_challenge_match_proposal',{p_proposal_id:pendingProposal.proposalId});
        if(error||!match)throw error||new Error('Kampen kunne ikke opprettes.');
        const variant=match.game_variant||pendingProposal.gameVariant||'x01';
        if(pendingProposal.starter==='random'&&window.DartArenaCoinFlipSync){
          accept.textContent='Kaster mynt…';
          await window.DartArenaCoinFlipSync.start({
            matchId:match.id,
            gameVariant:variant,
            player1Id:match.player1_id,
            player2Id:match.player2_id,
            player1Name:names[match.player1_id]||'Spiller 1',
            player2Name:names[match.player2_id]||'Spiller 2',
            starterId:match.match_starter_id||match.turn_player_id
          });
          return;
        }
        await send('match-start',{matchId:match.id,gameVariant:variant});
        const page=window.DartArenaGames?.pageForVariant?.(variant)||pageForVariant(variant);
        location.href=`${page}?id=${encodeURIComponent(match.id)}`;
      }catch(error){document.getElementById('roomMessage').textContent=error?.message||'Kampen kunne ikke startes.';accept.disabled=false;accept.textContent='Godta og start kamp'}
    };

    reject.onclick=async()=>{
      const p=pendingProposal;if(!p)return;
      reject.disabled=true;
      try{
        if(p.proposalId){const {error}=await db.rpc('reject_challenge_match_proposal',{p_proposal_id:p.proposalId});if(error)throw error}
        pendingProposal=null;
        document.getElementById('proposalActions').classList.add('hidden');
        document.getElementById('proposalTitle').textContent='Ingen forslag ennå';
        document.getElementById('proposalText').textContent='Dere kan avtale et nytt oppsett.';
        clearProposalFlags();
        await send('proposal-rejected');
      }catch(error){document.getElementById('roomMessage').textContent=error?.message||'Kunne ikke avslå forslaget.'}
      finally{reject.disabled=false}
    };
  }
})();