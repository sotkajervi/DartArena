(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.92);backdrop-filter:blur(8px);padding:20px}
    .da-coin-card{width:min(520px,94vw);text-align:center;padding:28px 22px 24px;border:1px solid rgba(35,226,209,.28);border-radius:20px;background:#071416;box-shadow:0 22px 80px rgba(0,0,0,.5)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.14em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 20px;font-size:clamp(26px,6vw,42px)}
    .da-coin-stage{height:230px;display:grid;place-items:center;perspective:900px}
    .da-coin{position:relative;width:190px;height:190px;transform-style:preserve-3d;will-change:transform}
    .da-coin.is-flipping{animation:daCoinFlip 3.3s cubic-bezier(.18,.62,.18,1) forwards}
    .da-coin-face{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;padding:22px;box-sizing:border-box;backface-visibility:hidden;border:5px solid #b8c7c9;background:radial-gradient(circle at 35% 28%,#314549 0,#18292c 42%,#091315 76%);box-shadow:inset 0 0 0 5px rgba(255,255,255,.05),0 18px 40px rgba(0,0,0,.45);font-weight:950;font-size:clamp(18px,4vw,25px);line-height:1.08;overflow-wrap:anywhere}
    .da-coin-front{color:#eef8f8}.da-coin-back{transform:rotateY(180deg);color:#23e2d1}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}
    .da-coin-result{min-height:58px;margin-top:8px}.da-coin-result strong{display:block;font-size:22px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:5px;color:var(--muted)}
    @keyframes daCoinFlip{0%{transform:rotateY(0) rotateX(0) translateY(0)}18%{transform:rotateY(720deg) rotateX(80deg) translateY(-30px)}55%{transform:rotateY(2160deg) rotateX(220deg) translateY(-48px)}82%{transform:rotateY(3240deg) rotateX(320deg) translateY(-10px)}100%{transform:rotateY(3600deg) rotateX(360deg) translateY(0)}}
    @keyframes daCoinFlipBack{0%{transform:rotateY(0) rotateX(0) translateY(0)}18%{transform:rotateY(720deg) rotateX(80deg) translateY(-30px)}55%{transform:rotateY(2160deg) rotateX(220deg) translateY(-48px)}82%{transform:rotateY(3240deg) rotateX(320deg) translateY(-10px)}100%{transform:rotateY(3780deg) rotateX(360deg) translateY(0)}}
    @media(max-width:520px){.da-coin-stage{height:205px}.da-coin{width:165px;height:165px}.da-coin-card{padding:24px 16px 20px}}
    @media(prefers-reduced-motion:reduce){.da-coin.is-flipping{animation-duration:.8s}}
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function play({player1Id,player2Id,player1Name='Spiller 1',player2Name='Spiller 2',winnerId,duration=3300}={}){
    if(active)return;
    active=true;
    const winnerSide=winnerId===player2Id?'back':'front';
    const winnerName=winnerSide==='back'?player2Name:player1Name;
    const overlay=document.createElement('div');
    overlay.className='da-coin-overlay';
    overlay.innerHTML=`<section class="da-coin-card" role="dialog" aria-modal="true" aria-label="Myntkast">
      <div class="da-coin-kicker">HVEM STARTER?</div>
      <h2 class="da-coin-title">Myntkast</h2>
      <div class="da-coin-stage">
        <div class="da-coin" data-winner-side="${winnerSide}">
          <div class="da-coin-face da-coin-front"></div>
          <div class="da-coin-face da-coin-back"></div>
        </div>
      </div>
      <div class="da-coin-result"><span>Kaster mynten…</span></div>
    </section>`;
    const front=overlay.querySelector('.da-coin-front'),back=overlay.querySelector('.da-coin-back'),coin=overlay.querySelector('.da-coin'),result=overlay.querySelector('.da-coin-result');
    front.textContent=player1Name;back.textContent=player2Name;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>coin.classList.add('is-flipping'));
    await sleep(duration);
    result.innerHTML=`<strong>${winnerName} vant myntkastet</strong><span>${winnerName} starter kampen</span>`;
    await sleep(850);
    overlay.remove();
    active=false;
  }

  window.DartArenaCoinFlip={play};
})();