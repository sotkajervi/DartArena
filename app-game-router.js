(()=>{
  const brand=document.querySelector('header .brand');
  if(brand&&!brand.dataset.homeLinkReady){
    brand.dataset.homeLinkReady='1';
    brand.setAttribute('role','link');
    brand.setAttribute('tabindex','0');
    brand.setAttribute('aria-label','Til hovedlobby');
    brand.setAttribute('title','Til hovedlobby');
    brand.style.cursor='pointer';
    const goHome=()=>{ window.location.href='./'; };
    brand.addEventListener('click',goHome);
    brand.addEventListener('keydown',(event)=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        goHome();
      }
    });
  }

  function ensureLiveMatches(){
    if(!document.getElementById('active-matches-style')){
      const link=document.createElement('link');
      link.id='active-matches-style';
      link.rel='stylesheet';
      link.href='active-matches.css?v=20261002-liveprivacy3';
      document.head.appendChild(link);
    }
    const lobby=document.getElementById('lobbyView');
    if(lobby){
      let section=document.getElementById('liveMatchesSection');
      if(!section){
        section=document.createElement('section');
        section.id='liveMatchesSection';
        section.className='card live-matches-section';
        section.innerHTML='<div class="heading"><div><small>PÅGÅENDE KAMPER</small><h2>Pågår nå</h2></div></div><p class="muted compact">Alle pågående kamper vises her. Bare kamper merket LIVE kan åpnes av tilskuere.</p><div id="liveMatchesList" class="live-matches-list"><p class="muted">Laster pågående kamper…</p></div>';
      }
      const lobbyGrid=lobby.querySelector('.lobby-grid');
      if(lobbyGrid&&section.previousElementSibling!==lobbyGrid){
        lobbyGrid.insertAdjacentElement('afterend',section);
      }else if(!section.isConnected){
        lobby.appendChild(section);
      }
    }
    if(!document.querySelector('script[data-dartarena-live-matches]')){
      const script=document.createElement('script');
      script.src='active-matches.js?v=20261002-liveprivacy3';
      script.dataset.dartarenaLiveMatches='1';
      document.body.appendChild(script);
    }
  }
  ensureLiveMatches();
  [100,400,1000,2200].forEach(delay=>setTimeout(ensureLiveMatches,delay));

  const boot=setInterval(()=>{
    ensureLiveMatches();
    if(!window.DartArenaGames||typeof openMatch!=='function')return;
    clearInterval(boot);
    openMatch=function(id,manual,variant='x01'){
      const page=window.DartArenaGames.pageForVariant(variant);
      const w=window.open(`${page}?id=${encodeURIComponent(id)}`,`dartarena-match-${id}`);
      if(!w&&manual)alert('Nettleseren blokkerte kampfanen.');
      return w;
    };

    if(typeof loadLobby==='function'&&!window.__dartArenaJdcLobbyLabel){
      window.__dartArenaJdcLobbyLabel=true;
      const baseLoadLobby=loadLobby;
      loadLobby=async function(){
        ensureLiveMatches();
        const result=await baseLoadLobby();
        ensureLiveMatches();
        if(activeMatch?.game_variant==='jdc'){
          const text=document.getElementById('activeMatchText');
          if(text)text.textContent=text.textContent.replace(/•\s*501\s*•\s*Best of 1\s*$/,'• JDC Challenge • 57 piler hver');
        }
        return result;
      };
    }

    const jdcCard=document.getElementById('soloJdcChallengeCard');
    const description=jdcCard?.querySelector('.training-game-main p');
    if(description)description.textContent='57 piler i tre faser. Solo er trening; Top 10 og JDC-tier teller kun fra online-kamper.';
  },50);
  setTimeout(()=>clearInterval(boot),5000);
})();