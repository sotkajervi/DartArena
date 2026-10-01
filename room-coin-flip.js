(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.93);backdrop-filter:blur(9px);padding:20px}
    .da-coin-card{width:min(520px,94vw);text-align:center;padding:28px 22px 24px;border:1px solid rgba(35,226,209,.28);border-radius:20px;background:linear-gradient(180deg,#081719,#061113);box-shadow:0 22px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.03)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.14em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 18px;font-size:clamp(26px,6vw,42px)}
    .da-coin-stage{height:245px;display:grid;place-items:center;perspective:1100px;position:relative}
    .da-coin-stage:after{content:'';position:absolute;width:150px;height:28px;border-radius:50%;background:rgba(0,0,0,.48);filter:blur(10px);bottom:20px;transform:scaleX(.9);opacity:.65}
    .da-coin{position:relative;width:198px;height:198px;transform-style:preserve-3d;will-change:transform;z-index:1;filter:drop-shadow(0 18px 18px rgba(0,0,0,.38))}
    .da-coin:before{content:'';position:absolute;inset:4px;border-radius:50%;transform:translateZ(-7px);background:linear-gradient(90deg,#6d531b 0,#d5b45b 12%,#7a5a18 25%,#f2d88a 48%,#765618 70%,#cfae54 88%,#604817 100%);box-shadow:0 0 0 3px #4b3811,0 0 0 6px #a98531}
    .da-coin.is-flipping{animation:daCoinFlip 3.3s cubic-bezier(.16,.72,.19,1) forwards}
    .da-coin-face{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;backface-visibility:hidden;border:6px solid #9c7927;background:
      radial-gradient(circle at 34% 27%,rgba(255,255,255,.34) 0 2%,transparent 15%),
      radial-gradient(circle at 50% 42%,#f3dc91 0,#d8b75a 34%,#9b7422 66%,#5f4513 100%);
      box-shadow:inset 0 0 0 2px rgba(255,249,208,.6),inset 0 0 0 8px rgba(79,54,8,.38),inset 8px 10px 22px rgba(255,255,255,.11),inset -10px -14px 24px rgba(60,39,3,.36)}
    .da-coin-back{transform:rotateY(180deg)}
    .da-coin-face:after{content:'';position:absolute;inset:20px;border-radius:50%;border:1px solid rgba(77,54,12,.6);box-shadow:0 0 0 2px rgba(255,238,174,.18),inset 0 0 18px rgba(77,52,5,.22);pointer-events:none}
    .da-coin-name{position:relative;z-index:3;max-width:120px;padding:10px 12px;border-radius:999px;color:#171106;text-shadow:0 1px rgba(255,255,255,.35);font-weight:950;font-size:clamp(17px,3.8vw,23px);line-height:1.05;overflow-wrap:anywhere;letter-spacing:.01em;box-shadow:inset 0 1px rgba(255,255,255,.18)}
    .da-coin-front .da-coin-name{background:rgba(255,245,203,.18)}
    .da-coin-back .da-coin-name{background:rgba(35,226,209,.13);color:#10211f}
    .da-coin-edge-svg{position:absolute;inset:8px;width:calc(100% - 16px);height:calc(100% - 16px);z-index:2;overflow:visible;filter:drop-shadow(0 1px rgba(255,255,255,.3))}
    .da-coin-edge-svg text{font-size:8px;font-weight:950;letter-spacing:2.2px;fill:#4c360b}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}
    .da-coin.is-settled{animation:daCoinSettle .55s ease-out both}
    .da-coin.is-winner{filter:drop-shadow(0 0 16px rgba(35,226,209,.45)) drop-shadow(0 18px 18px rgba(0,0,0,.38))}
    .da-coin-result{min-height:58px;margin-top:7px}.da-coin-result strong{display:block;font-size:22px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:5px;color:var(--muted)}
    @keyframes daCoinFlip{0%{transform:rotateY(0) rotateX(0) translateY(0) scale(1)}14%{transform:rotateY(640deg) rotateX(60deg) translateY(-38px) scale(1.04)}48%{transform:rotateY(2220deg) rotateX(205deg) translateY(-56px) scale(1.06)}76%{transform:rotateY(3200deg) rotateX(316deg) translateY(-15px) scale(1.015)}92%{transform:rotateY(3540deg) rotateX(352deg) translateY(-4px) scale(1)}100%{transform:rotateY(3600deg) rotateX(360deg) translateY(0) scale(1)}}
    @keyframes daCoinFlipBack{0%{transform:rotateY(0) rotateX(0) translateY(0) scale(1)}14%{transform:rotateY(640deg) rotateX(60deg) translateY(-38px) scale(1.04)}48%{transform:rotateY(2220deg) rotateX(205deg) translateY(-56px) scale(1.06)}76%{transform:rotateY(3260deg) rotateX(316deg) translateY(-15px) scale(1.015)}92%{transform:rotateY(3710deg) rotateX(352deg) translateY(-4px) scale(1)}100%{transform:rotateY(3780deg) rotateX(360deg) translateY(0) scale(1)}}
    @keyframes daCoinSettle{0%{transform:translateY(0) rotateZ(0)}30%{transform:translateY(-5px) rotateZ(-2.5deg)}55%{transform:translateY(2px) rotateZ(1.8deg)}75%{transform:translateY(-1px) rotateZ(-.8deg)}100%{transform:translateY(0) rotateZ(0)}}
    @media(max-width:520px){.da-coin-stage{height:218px}.da-coin{width:170px;height:170px}.da-coin-card{padding:24px 16px 20px}.da-coin-name{max-width:100px;font-size:17px}.da-coin-edge-svg text{font-size:7px;letter-spacing:1.8px}}
    @media(prefers-reduced-motion:reduce){.da-coin.is-flipping{animation-duration:.8s}.da-coin.is-settled{animation-duration:.25s}}
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const faceHtml=(name,id)=>`<svg class="da-coin-edge-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0"/></defs><text><textPath href="#${id}" startOffset="2%">DARTARENA • DARTARENA • DARTARENA •</textPath></text></svg><span class="da-coin-name">${esc(name)}</span>`;

  async function play({player1Id,player2Id,player1Name='Spiller 1',player2Name='Spiller 2',winnerId,duration=3300}={}){
    if(active)return;
    active=true;
    const winnerSide=winnerId===player2Id?'back':'front';
    const winnerName=winnerSide==='back'?player2Name:player1Name;
    const overlay=document.createElement('div');
    overlay.className='da-coin-overlay';
    const uid='coin'+Date.now();
    overlay.innerHTML=`<section class="da-coin-card" role="dialog" aria-modal="true" aria-label="Myntkast">
      <div class="da-coin-kicker">HVEM STARTER?</div>
      <h2 class="da-coin-title">Myntkast</h2>
      <div class="da-coin-stage">
        <div class="da-coin" data-winner-side="${winnerSide}">
          <div class="da-coin-face da-coin-front">${faceHtml(player1Name,uid+'a')}</div>
          <div class="da-coin-face da-coin-back">${faceHtml(player2Name,uid+'b')}</div>
        </div>
      </div>
      <div class="da-coin-result"><span>Kaster mynten…</span></div>
    </section>`;
    const coin=overlay.querySelector('.da-coin'),result=overlay.querySelector('.da-coin-result');
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>coin.classList.add('is-flipping'));
    await sleep(duration);
    coin.classList.remove('is-flipping');
    coin.style.transform=winnerSide==='back'?'rotateY(180deg)':'rotateY(0deg)';
    coin.classList.add('is-settled','is-winner');
    result.innerHTML=`<strong>${esc(winnerName)} vant myntkastet</strong><span>${esc(winnerName)} starter kampen</span>`;
    await sleep(950);
    overlay.remove();
    active=false;
  }

  window.DartArenaCoinFlip={play};
})();