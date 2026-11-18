(()=>{
  if(window.__dartArenaJdcFinishPolish)return;
  window.__dartArenaJdcFinishPolish=true;

  const COLORS={
    white:'#eef8f8',
    purple:'#b678ff',
    yellow:'#ffd84d',
    green:'#55d98b',
    blue:'#4da3ff',
    red:'#ff6262',
    black:'#8e9b9f',
    gold:'#e7b84b'
  };
  const tierFor=score=>score>=1250?'gold':score>=850?'black':score>=700?'red':score>=600?'blue':score>=450?'green':score>=300?'yellow':score>=150?'purple':'white';
  const labelFor=tier=>tier.charAt(0).toUpperCase()+tier.slice(1)+' tier';

  const style=document.createElement('style');
  style.textContent=`
    #winnerText .jdc-finish-winner-line{display:block;line-height:1.2}
    #winnerText .jdc-finish-score-line{display:block;margin-top:7px;font-size:1.35em;color:#00eaf4;font-weight:950}
    #tierText .jdc-tier-text{font-weight:950}
    #dartArenaResultOverlay .jdc-finish-tier-grid{margin:12px 0 6px;padding:9px 11px;background:#091c22;border:1px solid #31505a;border-radius:10px}
    #dartArenaResultOverlay .jdc-finish-tier-grid>strong{display:block;margin-bottom:7px;color:#00eaf4;font-size:12px}
    #dartArenaResultOverlay .jdc-finish-tier-columns{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px 9px}
    #dartArenaResultOverlay .jdc-finish-tier-item{display:flex;align-items:center;gap:5px;font-size:10px;white-space:nowrap}
    #dartArenaResultOverlay .jdc-finish-tier-item i{width:8px;height:8px;flex-shrink:0;margin:0}
    @media(max-width:600px){#dartArenaResultOverlay .jdc-finish-tier-columns{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);

  function currentData(){
    const n1=document.getElementById('player1Name')?.textContent?.trim();
    const n2=document.getElementById('player2Name')?.textContent?.trim();
    const s1=Number(document.getElementById('player1Score')?.textContent||0);
    const s2=Number(document.getElementById('player2Score')?.textContent||0);
    if(!n1||!n2)return null;
    const winnerIs1=s1>=s2;
    return{
      n1,n2,s1,s2,
      winnerName:winnerIs1?n1:n2,
      loserName:winnerIs1?n2:n1,
      winnerScore:winnerIs1?s1:s2,
      loserScore:winnerIs1?s2:s1
    };
  }

  function polishSideCard(){
    const box=document.getElementById('finishedBox');
    const winner=document.getElementById('winnerText');
    const tierText=document.getElementById('tierText');
    const d=currentData();
    if(!box||box.classList.contains('hidden')||!winner||!tierText||!d)return false;

    winner.innerHTML=`<span class="jdc-finish-winner-line">${d.winnerName} slo ${d.loserName}</span><span class="jdc-finish-score-line">${d.winnerScore}–${d.loserScore}</span>`;

    const ownName=document.getElementById('localVideoName')?.textContent?.trim();
    const ownScore=ownName===d.n1?d.s1:ownName===d.n2?d.s2:null;
    const score=ownScore??Number((tierText.textContent.match(/score:\s*(\d+)/i)||[])[1]||0);
    const tier=tierFor(score);
    tierText.innerHTML=`Din offisielle score: ${score} • <strong class="jdc-tier-text" style="color:${COLORS[tier]}">${labelFor(tier)}</strong>`;
    return true;
  }

  function polishSharedOverlay(){
    const overlay=document.getElementById('dartArenaResultOverlay');
    const d=currentData();
    if(!overlay||!d)return false;

    const title=overlay.querySelector('.da-result-title');
    if(title)title.innerHTML=`<span class="da-result-winner-name">${d.winnerName}</span> slo ${d.loserName}`;

    const scoreBox=overlay.querySelector('.da-result-scorebox');
    if(scoreBox)scoreBox.innerHTML=`${d.winnerScore}<span>–</span>${d.loserScore}`;

    overlay.querySelectorAll('.da-result-statrow').forEach(row=>{
      const label=row.querySelector('span')?.textContent?.trim();
      const value=row.querySelector('b');
      if(label!=='TIER'||!value)return;
      const tier=String(value.textContent||'').trim().split(/\s+/)[0].toLowerCase();
      if(COLORS[tier])value.style.color=COLORS[tier];
    });

    // Make the exact official tier thresholds visible on the finished-match overlay.
    if(!overlay.querySelector('.jdc-finish-tier-grid')){
      const tiers=[
        ['white','White','0–149'],['purple','Purple','150–299'],
        ['yellow','Yellow','300–449'],['green','Green','450–599'],
        ['blue','Blue','600–699'],['red','Red','700–849'],
        ['black','Black','850–1249'],['gold','Gold','1250+']
      ];
      const grid=document.createElement('section');grid.className='jdc-finish-tier-grid';
      const label=document.createElement('strong');label.textContent='JDC Tierliste · poenggrenser';
      const columns=document.createElement('div');columns.className='jdc-finish-tier-columns';
      tiers.forEach(([key,name,range])=>{
        const item=document.createElement('div');item.className='jdc-finish-tier-item';
        const dot=document.createElement('i');dot.className='jdc-tier-dot';dot.dataset.jdcTier=key;
        const txt=document.createElement('span');txt.textContent=name+' '+range;
        item.append(dot,txt);columns.appendChild(item);
      });
      grid.append(label,columns);
      const stats=overlay.querySelector('.da-result-stats');
      if(stats)stats.insertAdjacentElement('afterend',grid);
      else overlay.querySelector('.da-result-card')?.appendChild(grid);
    }

    const lobbyBtn=overlay.querySelector('#daResultLobby');
    if(lobbyBtn)lobbyBtn.remove();
    const closeBtn=overlay.querySelector('#daResultClose');
    if(closeBtn){closeBtn.textContent='Lukk kampfane';closeBtn.classList.remove('outline');closeBtn.classList.add('primary')}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    const sideDone=polishSideCard();
    const overlayDone=polishSharedOverlay();
    if((sideDone&&overlayDone)||++tries>=80)clearInterval(timer);
  },250);
})();