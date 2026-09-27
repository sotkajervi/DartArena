// Keeps all cup round headings on one line and centers every later-round match
// exactly between the two feeder matches from the previous round.
(()=>{
  const bracket=document.getElementById('cupBracket');
  if(!bracket)return;
  let frame=0;

  function resetMobile(rounds){
    bracket.style.minHeight='';
    rounds.forEach(round=>{
      round.style.position='';
      round.style.display='';
      round.style.height='';
      round.style.paddingTop='';
      const title=round.querySelector('.cup-round-title');
      if(title){title.style.position='';title.style.top='';title.style.left='';title.style.right='';title.style.height='';}
      round.querySelectorAll('.cup-match').forEach(match=>{
        match.style.position='';match.style.top='';match.style.left='';match.style.right='';match.style.transform='';
      });
    });
  }

  function layout(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const rounds=[...bracket.querySelectorAll(':scope > .cup-round')];
      if(!rounds.length)return;
      if(window.matchMedia('(max-width:850px)').matches){resetMobile(rounds);return;}

      // Reset before measuring so old inline positions can never influence a new layout.
      rounds.forEach(round=>{
        round.style.position='relative';
        round.style.display='block';
        round.style.height='auto';
        round.style.paddingTop='0';
        const title=round.querySelector('.cup-round-title');
        if(title){
          title.style.position='absolute';
          title.style.top='0';
          title.style.left='0';
          title.style.right='0';
          title.style.height='24px';
        }
        round.querySelectorAll('.cup-match').forEach(match=>{
          match.style.position='static';
          match.style.top='';
          match.style.left='';
          match.style.right='';
          match.style.transform='none';
        });
      });

      const first=[...rounds[0].querySelectorAll('.cup-match')];
      if(!first.length)return;
      const all=[...bracket.querySelectorAll('.cup-match')];
      const cardHeight=Math.max(96,...all.map(m=>m.offsetHeight));
      const gap=16;
      const pitch=cardHeight+gap;
      const titleArea=42;
      const baseCount=first.length;
      const totalHeight=titleArea+cardHeight+(baseCount-1)*pitch+4;

      bracket.style.minHeight=`${totalHeight}px`;
      rounds.forEach((round,roundIndex)=>{
        round.style.height=`${totalHeight}px`;
        const matches=[...round.querySelectorAll('.cup-match')];
        const step=2**roundIndex;
        matches.forEach((match,index)=>{
          // Round 1 centers: 0,1,2,3... pitches.
          // Round 2 centers: 0.5,2.5...; final: 1.5... etc.
          const feederMid=((step-1)/2)+(index*step);
          const center=titleArea+(cardHeight/2)+(feederMid*pitch);
          match.style.position='absolute';
          match.style.left='0';
          match.style.right='0';
          match.style.top=`${Math.round(center-(match.offsetHeight/2))}px`;
          match.style.transform='none';
        });
      });
    });
  }

  const observer=new MutationObserver(layout);
  observer.observe(bracket,{childList:true,subtree:true,characterData:true});
  if('ResizeObserver' in window)new ResizeObserver(layout).observe(bracket);
  window.addEventListener('resize',layout);
  window.addEventListener('load',layout);
  setTimeout(layout,100);
  setTimeout(layout,600);
})();