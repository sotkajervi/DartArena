(()=>{
  let tries=0;
  const lock=()=>{
    tries++;
    const c1=document.getElementById('p1Card');
    const c2=document.getElementById('p2Card');
    const n1=document.getElementById('name1');
    const n2=document.getElementById('name2');
    if(!c1||!c2||!n1||!n2){if(tries<80)setTimeout(lock,100);return}
    const a=(n1.textContent||'').trim(),b=(n2.textContent||'').trim();
    if(!a||!b||a==='Spiller 1'||b==='Spiller 2'){if(tries<80)setTimeout(lock,100);return}
    c1.dataset.playerName=a;
    c2.dataset.playerName=b;
  };
  lock();
})();
