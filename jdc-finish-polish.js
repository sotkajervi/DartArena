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