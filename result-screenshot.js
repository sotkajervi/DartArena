(()=>{
  if(new URLSearchParams(location.search).get('simulation')==='1'&&!document.querySelector('script[data-bye-sim-fix]')){
    const s=document.createElement('script');s.src='result-bye-simulation-fix.js?v=20260927-1';s.dataset.byeSimFix='1';document.head.appendChild(s);
  }
  const main=document.querySelector('main');if(!main)return;
  const css=document.createElement('style');
  css.textContent=`
.share-result-overlay{position:fixed;inset:0;z-index:20000;background:#030a0c;overflow:hidden;display:block}
.share-result-close{position:absolute;right:12px;top:10px;z-index:2;padding:7px 14px;font-size:12px}
.share-result-card{position:absolute;transform-origin:top left;background:#071416;color:#eef8f8;border:1px solid #245154;border-radius:16px;padding:20px;box-sizing:border-box}
.share-result-brand{font-size:18px;font-weight:950;letter-spacing:2px;margin-bottom:12px}.share-result-brand span{color:#23e2d1}
.share-result-card main{width:100%;max-width:none;margin:0;padding:0}
.share-result-card .top-actions,.share-result-card button,.share-result-card .spectator-videos,.share-result-card .stats-details{display:none!important}
.share-result-card .results-head,.share-result-card .stats-head,.share-result-card .viewer-head{margin:0 0 12px;display:block}
.share-result-card h1{font-size:26px;margin:3px 0}.share-result-card h2{font-size:17px;margin:3px 0}
.share-result-card .card{padding:14px;background:#0a1b1e}
.share-result-card .winner-card{padding:14px}.share-result-card .winner-name{font-size:34px;margin:2px}
.share-result-card .podium-grid{grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.share-result-card .podium-box{padding:8px}.share-result-card .podium-box strong{font-size:15px}
.share-result-card .section-card{margin-top:10px}.share-result-card .section-card>p{display:none}
.share-result-card .stats-scroll{overflow:visible;margin-top:8px}
.share-result-card .results-table{min-width:0;width:100%;table-layout:fixed}
.share-result-card .results-table th,.share-result-card .results-table td{padding:7px 3px;font-size:12px;white-space:normal;overflow-wrap:anywhere}
.share-result-card .results-table th{font-size:9px;letter-spacing:0}
.share-result-card .results-table th:first-child{width:16%}
.share-result-card .highlight-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
.share-result-card .highlight-grid .card{padding:10px}
.share-result-card .highlight-list{gap:4px;margin-top:8px}
.share-result-card .highlight-row{grid-template-columns:18px minmax(0,1fr) auto;padding:6px;gap:5px;border-radius:7px}
.share-result-card .highlight-rank{width:18px;height:18px;font-size:10px}
.share-result-card .highlight-name{font-size:11px;white-space:normal;overflow-wrap:anywhere}
.share-result-card .highlight-note{font-size:9px}.share-result-card .highlight-value{font-size:14px}
.share-result-card .stats-result{font-size:40px;margin:0 0 12px}
.share-result-card .match-stats-grid{grid-template-columns:40% 30% 30%}
.share-result-card .match-stats-grid>*{padding:8px;font-size:13px}
.share-result-card .spectator-score{padding:8px}.share-result-card .spectator-points{font-size:40px}
.share-result-card .spectator-stats-card{margin-top:10px}
.share-result-card .spectator-stats-heading{display:flex;flex-direction:row}
.share-result-card .results-empty{font-size:11px;padding:8px}
`;document.head.appendChild(css);
  const btn=document.createElement('button');btn.type='button';btn.className='outline';btn.textContent='Skjermbilde';
  const actions=main.querySelector('.top-actions')||main.querySelector('.stats-head')||main;
  actions.appendChild(btn);
  btn.onclick=()=>{
    const priorOverflow=document.body.style.overflow;
    const overlay=document.createElement('div');overlay.className='share-result-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Resultat til skjermbilde');
    const close=document.createElement('button');close.className='outline share-result-close';close.textContent='Lukk · Esc';
    const card=document.createElement('div');card.className='share-result-card';
    const brand=document.createElement('div');brand.className='share-result-brand';brand.innerHTML='DART<span>ARENA</span>';
    const clone=main.cloneNode(true);clone.querySelectorAll('script,button,.top-actions,.spectator-videos,.stats-details').forEach(el=>el.remove());
    clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    card.append(brand,clone);overlay.append(close,card);document.body.appendChild(overlay);document.body.style.overflow='hidden';
    const fit=()=>{
      const w=window.innerWidth,h=window.innerHeight;
      card.style.width=(clone.querySelector('.results-table')?1040:Math.min(720,Math.max(360,w-20)))+'px';
      const scale=Math.min(1,(w-20)/card.offsetWidth,(h-60)/card.offsetHeight);
      card.style.transform='scale('+scale+')';card.style.left=((w-card.offsetWidth*scale)/2)+'px';card.style.top=(50+(h-60-card.offsetHeight*scale)/2)+'px';
    };
    const dismiss=()=>{window.removeEventListener('resize',fit);document.removeEventListener('keydown',key);overlay.remove();document.body.style.overflow=priorOverflow;btn.focus()};
    const key=e=>{if(e.key==='Escape')dismiss();if(e.key==='Tab'){e.preventDefault();close.focus()}};
    close.onclick=dismiss;document.addEventListener('keydown',key);window.addEventListener('resize',fit);fit();close.focus();
  };
})();
