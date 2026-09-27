(()=>{
  const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
  function parseScore(text){const m=String(text||'').match(/(\d+)\s*[-–:]\s*(\d+)/);return m?[Number(m[1]),Number(m[2])]:null}
  function snapshot(){
    const matches=[];
    document.querySelectorAll('.simulation-match').forEach(el=>{const ps=el.querySelectorAll('.match-players strong'),sc=parseScore(el.querySelector('.match-score')?.textContent);if(ps.length<2||!sc)return;const a=ps[0].textContent.trim(),b=ps[1].textContent.trim();matches.push({stage:'group',a,b,score:sc,winner:sc[0]>sc[1]?a:b})});
    const rounds=[...document.querySelectorAll('#cupBracket .cup-round')];
    rounds.forEach((round,ri)=>round.querySelectorAll('.simulation-cup-match').forEach(el=>{const names=[...el.querySelectorAll('.cup-name')].map(n=>n.textContent.trim()).filter(n=>n&&n!=='Venter'),sc=parseScore(el.querySelector('.cup-score')?.textContent);if(names.length<2||!sc)return;matches.push({stage:'cup',round:ri+1,a:names[0],b:names[1],score:sc,winner:sc[0]>sc[1]?names[0]:names[1]})}));
    const winner=String($('cupProgress')?.textContent||'').replace(/^.*Vinner:\s*/,'').trim();
    const finalRound=rounds.at(-1),finalCard=finalRound?.querySelector('.simulation-cup-match'),finalNames=[...finalCard?.querySelectorAll('.cup-name')||[]].map(n=>n.textContent.trim()).filter(n=>n&&n!=='Venter'),finalScore=parseScore(finalCard?.querySelector('.cup-score')?.textContent),runner=finalNames.length===2&&finalScore?(finalScore[0]>finalScore[1]?finalNames[1]:finalNames[0]):'';
    const semiRound=rounds.at(-2),semiLosers=[];semiRound?.querySelectorAll('.simulation-cup-match').forEach(el=>{const ns=[...el.querySelectorAll('.cup-name')].map(n=>n.textContent.trim()).filter(n=>n&&n!=='Venter'),sc=parseScore(el.querySelector('.cup-score')?.textContent);if(ns.length===2&&sc)semiLosers.push(sc[0]>sc[1]?ns[1]:ns[0])});
    return{tournamentName:$('tName')?.textContent?.trim()||'Testturnering',winner,runner,semifinalists:semiLosers,matches};
  }
  function addButton(){
    const progress=$('cupProgress'),controls=$('cupSimulationControls');if(!progress||!controls||!/^Vinner:/.test(progress.textContent.trim()))return;
    if($('openSimResultsBtn'))return;const b=document.createElement('button');b.id='openSimResultsBtn';b.className='primary';b.textContent='Se sluttresultat og statistikk';b.onclick=()=>{sessionStorage.setItem('dartarena-sim-results',JSON.stringify(snapshot()));location.href=`tournament-results.html?id=${encodeURIComponent(id||'')}&simulation=1`};controls.appendChild(b);
  }
  new MutationObserver(addButton).observe(document.documentElement,{subtree:true,childList:true,characterData:true});setInterval(addButton,700);addButton();
})();