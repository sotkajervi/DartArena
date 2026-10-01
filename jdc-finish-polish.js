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

  function polishSideCard(){
    const box=document.getElementById('finishedBox');
    const winner=document.getElementById('winnerText');
    const tierText=document.getElementById('tierText');
    const n1=document.getElementById('player1Name')?.textContent?.trim();
    const n2=document.getElementById('player2Name')?.textContent?.trim();
    const s1=Number(document.getElementById('player1Score')?.textContent||0);
    const s2=Number(document.getElementById('player2Score')?.textContent||0);
    if(!box||box.classList.contains('hidden')||!winner||!tierText||!n1||!n2)return false;

    const winnerIs1=s1>=s2;
    const winnerName=winnerIs1?n1:n2;
    const loserName=winnerIs1?n2:n1;
    const winnerScore=winnerIs1?s1:s2;
    const loserScore=winnerIs1?s2:s1;
    winner.innerHTML=`<span class="jdc-finish-winner-line">${winnerName} slo ${loserName}</span><span class="jdc-finish-score-line">${winnerScore}–${loserScore}</span>`;

    const ownName=document.getElementById('localVideoName')?.textContent?.trim();
    const ownScore=ownName===n1?s1:ownName===n2?s2:null;
    const score=ownScore??Number((tierText.textContent.match(/score:\s*(\d+)/i)||[])[1]||0);
    const tier=tierFor(score);
    tierText.innerHTML=`Din offisielle score: ${score} • <strong class="jdc-tier-text" style="color:${COLORS[tier]}">${labelFor(tier)}</strong>`;
    return true;
  }

  function polishSharedOverlay(){
    const overlay=document.getElementById('dartArenaResultOverlay');
    if(!overlay)return false;
    overlay.querySelectorAll('.da-result-statrow').forEach(row=>{
      const label=row.querySelector('span')?.textContent?.trim();
      const value=row.querySelector('b');
      if(label!=='TIER'||!value)return;
      const tier=String(value.textContent||'').trim().split(/\s+/)[0].toLowerCase();
      if(COLORS[tier])value.style.color=COLORS[tier];
    });
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    const sideDone=polishSideCard();
    const overlayDone=polishSharedOverlay();
    if((sideDone&&overlayDone)||++tries>=80)clearInterval(timer);
  },250);
})();