(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.93);backdrop-filter:blur(9px);padding:20px}
    .da-coin-card{width:min(540px,94vw);text-align:center;padding:28px 22px 24px;border:1px solid rgba(35,226,209,.28);border-radius:20px;background:linear-gradient(180deg,#081719,#061113);box-shadow:0 22px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.03)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.14em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 16px;font-size:clamp(26px,6vw,42px)}
    .da-coin-stage{height:275px;display:grid;place-items:center;perspective:1250px;position:relative}
    .da-coin-stage:after{content:'';position:absolute;width:170px;height:30px;border-radius:50%;background:rgba(0,0,0,.5);filter:blur(11px);bottom:18px;transform:scaleX(.92);opacity:.68}
    .da-coin{position:relative;width:214px;height:214px;transform-style:preserve-3d;will-change:transform;z-index:1;filter:drop-shadow(0 20px 19px rgba(0,0,0,.42))}
    .da-coin.is-flipping{animation:daCoinFlip 3.3s cubic-bezier(.16,.72,.19,1) forwards}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}

    .da-coin-edge-layer{position:absolute;inset:3px;border-radius:50%;box-sizing:border-box;background:
      repeating-conic-gradient(from 0deg,#5f4512 0 2deg,#c89e3f 2deg 4deg,#775718 4deg 6deg,#edcf73 6deg 8deg,#6b4d13 8deg 10deg);
      border:2px solid rgba(67,43,7,.88);box-shadow:inset 0 0 7px rgba(255,226,131,.25),inset 0 0 18px rgba(50,31,2,.45)}
    .da-coin-edge-layer:after{content:'';position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 1deg,rgba(255,245,190,.24) 0 1deg,rgba(0,0,0,.22) 1deg 2.2deg,transparent 2.2deg 4deg);mix-blend-mode:overlay;opacity:.78}
    .da-edge-1{transform:translateZ(-14px)}.da-edge-2{transform:translateZ(-10px)}.da-edge-3{transform:translateZ(-6px)}.da-edge-4{transform:translateZ(-2px)}.da-edge-5{transform:translateZ(2px)}.da-edge-6{transform:translateZ(6px)}.da-edge-7{transform:translateZ(10px)}.da-edge-8{transform:translateZ(14px)}

    .da-coin-face{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;backface-visibility:hidden;border:6px solid #9c7927;background:
      radial-gradient(circle at 34% 27%,rgba(255,255,255,.38) 0 2%,transparent 15%),
      radial-gradient(circle at 50% 42%,#f7e49d 0,#d8b75a 34%,#9b7422 66%,#5f4513 100%);
      box-shadow:inset 0 0 0 2px rgba(255,249,208,.68),inset 0 0 0 10px rgba(79,54,8,.34),inset 9px 11px 24px rgba(255,255,255,.12),inset -11px -15px 26px rgba(60,39,3,.38)}
    .da-coin-front{transform:translateZ(16px)}
    .da-coin-back{transform:rotateY(180deg) translateZ(16px)}
    .da-coin-face:after{content:'';position:absolute;inset:30px;border-radius:50%;border:1px solid rgba(77,54,12,.62);box-shadow:0 0 0 2px rgba(255,238,174,.16),inset 0 0 20px rgba(77,52,5,.24);pointer-events:none}

    .da-coin-name{position:relative;z-index:4;max-width:118px;padding:12px 13px;border-radius:999px;color:#171106;text-shadow:0 1px rgba(255,255,255,.38),0 -1px rgba(77,52,8,.12);font-weight:950;font-size:clamp(17px,3.8vw,23px);line-height:1.05;overflow-wrap:anywhere;letter-spacing:.01em;box-shadow:inset 0 1px rgba(255,255,255,.2),0 1px 0 rgba(82,55,8,.18)}
    .da-coin-front .da-coin-name{background:rgba(255,245,203,.17)}
    .da-coin-back .da-coin-name{background:rgba(35,226,209,.12);color:#10211f}

    .da-coin-edge-svg{position:absolute;inset:5px;width:calc(100% - 10px);height:calc(100% - 10px);z-index:3;overflow:visible;filter:drop-shadow(0 1px rgba(255,255,255,.32))}
    .da-coin-edge-svg text{font-size:7.3px;font-weight:950;letter-spacing:1.55px;fill:#4b3408}
    .da-coin-edge-svg .coin-dot{fill:#725214}

    .da-coin.is-settled{animation:daCoinSettle .55s ease-out both}
    .da-coin.is-winner{filter:drop-shadow(0 0 18px rgba(35,226,209,.48)) drop-shadow(0 20px 19px rgba(0,0,0,.42))}
    .da-coin-result{min-height:58px;margin-top:5px}.da-coin-result strong{display:block;font-size:22px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:5px;color:var(--muted)}

    @keyframes daCoinFlip{0%{transform:rotateY(0) rotateX(0) translateY(0) scale(1)}14%{transform:rotateY(640deg) rotateX(60deg) translateY(-43px) scale(1.04)}48%{transform:rotateY(2220deg) rotateX(205deg) translateY(-63px) scale(1.06)}76%{transform:rotateY(3200deg) rotateX(316deg) translateY(-17px) scale(1.015)}92%{transform:rotateY(3540deg) rotateX(352deg) translateY(-5px) scale(1)}100%{transform:rotateY(3600deg) rotateX(360deg) translateY(0) scale(1)}}
    @keyframes daCoinFlipBack{0%{transform:rotateY(0) rotateX(0) translateY(0) scale(1)}14%{transform:rotateY(640deg) rotateX(60deg) translateY(-43px) scale(1.04)}48%{transform:rotateY(2220deg) rotateX(205deg) translateY(-63px) scale(1.06)}76%{transform:rotateY(3260deg) rotateX(316deg) translateY(-17px) scale(1.015)}92%{transform:rotateY(3710deg) rotateX(352deg) translateY(-5px) scale(1)}100%{transform:rotateY(3780deg) rotateX(360deg) translateY(0) scale(1)}}
    @keyframes daCoinSettle{0%{transform:translateY(0) rotateZ(0)}30%{transform:translateY(-5px) rotateZ(-2.5deg)}55%{transform:translateY(2px) rotateZ(1.8deg)}75%{transform:translateY(-1px) rotateZ(-.8deg)}100%{transform:translateY(0) rotateZ(0)}}

    @media(max-width:520px){.da-coin-stage{height:235px}.da-coin{width:178px;height:178px}.da-coin-card{padding:24px 16px 20px}.da-coin-name{max-width:98px;font-size:17px}.da-coin-edge-svg text{font-size:6.7px;letter-spacing:1.28px}.da-coin-face:after{inset:25px}}
    @media(prefers-reduced-motion:reduce){.da-coin.is-flipping{animation-duration:.8s}.da-coin.is-settled{animation-duration:.25s}}
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const faceHtml=(name,id)=>`<svg class="da-coin-edge-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/></defs><text><textPath href="#${id}" startOffset="0%">DARTARENA • DARTARENA • DARTARENA •</textPath></text></svg><span class="da-coin-name">${esc(name)}</span>`;
  const edgeHtml=()=>Array.from({length:8},(_,i)=>`<div class="da-coin-edge-layer da-edge-${i+1}" aria-hidden="true"></div>`).join('');

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
          ${edgeHtml()}
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