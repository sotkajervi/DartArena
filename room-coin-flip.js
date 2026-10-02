(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.94);backdrop-filter:blur(10px);padding:20px}
    .da-coin-card{width:min(570px,94vw);text-align:center;padding:30px 22px 25px;border:1px solid rgba(35,226,209,.28);border-radius:22px;background:linear-gradient(180deg,#091a1c,#061113);box-shadow:0 26px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.035)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.16em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 8px;font-size:clamp(27px,6vw,43px)}
    .da-coin-stage{height:334px;display:grid;place-items:center;perspective:1450px;position:relative;overflow:visible}
    .da-coin-stage:after{content:'';position:absolute;width:210px;height:38px;border-radius:50%;background:rgba(0,0,0,.62);filter:blur(15px);bottom:20px;opacity:.78}

    .da-coin{--coin-size:238px;--coin-thickness:72px;--coin-half:36px;--flip-duration:3300ms;position:relative;width:var(--coin-size);height:var(--coin-size);transform-style:preserve-3d;transform-origin:50% 50% 0;will-change:transform;z-index:2;filter:drop-shadow(0 26px 25px rgba(0,0,0,.52))}
    .da-coin.is-flipping{animation:daCoinFlipFront var(--flip-duration) cubic-bezier(.15,.68,.17,1) forwards}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}

    /* Solid metal body. At 90deg these layers become a clearly visible 72px-wide edge. */
    .da-coin-depth{position:absolute;inset:0;transform-style:preserve-3d;pointer-events:none}
    .da-coin-depth-layer{position:absolute;inset:4px;border-radius:50%;box-sizing:border-box;backface-visibility:visible;-webkit-backface-visibility:visible;background:radial-gradient(circle at 30% 25%,rgba(255,239,178,.18),transparent 20%),linear-gradient(145deg,#3c2503 0%,#8b5b0f 21%,#e0b94f 46%,#9b6814 66%,#432803 100%);border:5px solid #6d4608;box-shadow:inset 0 0 0 1px rgba(255,235,157,.17),inset 0 0 14px rgba(29,16,0,.42)}
    .da-coin-depth-layer:nth-child(4n+1){filter:brightness(.72)}
    .da-coin-depth-layer:nth-child(4n+2){filter:brightness(.9)}
    .da-coin-depth-layer:nth-child(4n+3){filter:brightness(1.08)}
    .da-coin-depth-layer:nth-child(4n){filter:brightness(.82)}

    /* Ridges sit on top of the solid body and stay visible through the edge-on phase. */
    .da-coin-ridge{position:absolute;inset:1px;border-radius:50%;box-sizing:border-box;pointer-events:none;border:9px double rgba(88,55,6,.92);box-shadow:inset 0 0 0 2px rgba(255,230,143,.28),0 0 0 1px rgba(39,22,1,.9)}
    .da-coin-ridge-front{transform:translateZ(35px)}
    .da-coin-ridge-back{transform:rotateY(180deg) translateZ(35px)}

    .da-coin-face{position:absolute;inset:6px;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;border:5px solid #9c7221;background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.5) 0 2%,rgba(255,255,255,.08) 9%,transparent 19%),conic-gradient(from 18deg at 50% 50%,#aa7820,#f7dc84,#815813,#e6bc52,#69450c,#efd06f,#95671a,#f8e293,#7d5613,#d2a43b,#5d3d08,#aa7820);box-shadow:inset 0 0 0 2px rgba(255,250,216,.72),inset 0 0 0 10px rgba(72,47,5,.25),inset 11px 13px 26px rgba(255,255,255,.13),inset -13px -17px 30px rgba(48,29,1,.42),0 0 0 1px rgba(45,28,2,.88)}
    .da-coin-front{transform:translateZ(36px)}
    .da-coin-back{transform:rotateY(180deg) translateZ(36px)}
    .da-coin-face:before{content:'';position:absolute;inset:-30%;border-radius:50%;background:repeating-linear-gradient(100deg,rgba(255,255,255,.027) 0 1px,rgba(0,0,0,.028) 1px 2px),linear-gradient(112deg,transparent 34%,rgba(255,255,255,.24) 46%,rgba(255,244,187,.48) 50%,rgba(255,255,255,.12) 55%,transparent 67%);opacity:.64;transform:translateX(-29%) rotate(5deg);pointer-events:none;mix-blend-mode:soft-light}
    .da-coin.is-winner .da-coin-face:before{animation:daCoinGlint .82s ease-out both}
    .da-coin-face:after{content:'';position:absolute;inset:34px;border-radius:50%;border:1px solid rgba(73,49,8,.72);box-shadow:0 0 0 3px rgba(255,235,167,.15),0 0 0 6px rgba(76,51,7,.16),inset 0 0 22px rgba(69,44,3,.25);pointer-events:none}

    .da-coin-rim-svg{position:absolute;inset:7px;width:calc(100% - 14px);height:calc(100% - 14px);z-index:4;overflow:visible;filter:drop-shadow(0 1px rgba(255,250,210,.34))}
    .da-coin-rim-svg text{font-size:7.25px;font-weight:950;letter-spacing:1px;fill:#3b2705;text-transform:uppercase}

    .da-coin-core{position:relative;z-index:5;width:168px;height:112px;border-radius:54% / 72%;display:grid;place-items:center;padding:12px 10px;box-sizing:border-box;background:radial-gradient(circle at 34% 27%,rgba(255,255,255,.24),transparent 25%),radial-gradient(ellipse at center,#d9ae4b 0,#b68429 60%,#7b5514 100%);border:2px solid rgba(78,53,8,.72);box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(255,225,137,.12)}
    .da-coin-core:before,.da-coin-core:after{content:'';position:absolute;border-radius:50%;pointer-events:none}.da-coin-core:before{inset:8px;border:1px dashed rgba(74,49,6,.34)}.da-coin-core:after{inset:17px;border:1px solid rgba(255,239,184,.12)}
    .da-coin-name{position:relative;z-index:2;display:block;width:146px;max-width:146px;color:#1c1304;font-weight:1000;font-size:var(--name-size,15px);line-height:1;white-space:nowrap;word-break:normal;overflow-wrap:normal;overflow:visible;text-align:center;letter-spacing:-.02em;text-shadow:0 1px 0 rgba(255,246,205,.42),0 -1px 0 rgba(73,47,4,.16)}
    .da-coin-back .da-coin-core{box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(35,226,209,.12)}
    .da-coin-back .da-coin-name{color:#10211f;text-shadow:0 1px 0 rgba(255,246,205,.34)}

    .da-coin.is-settled{animation:daCoinSettleFront .72s cubic-bezier(.15,.82,.27,1) both}
    .da-coin[data-winner-side="back"].is-settled{animation-name:daCoinSettleBack}
    .da-coin.is-winner{filter:drop-shadow(0 0 22px rgba(35,226,209,.48)) drop-shadow(0 26px 25px rgba(0,0,0,.52))}
    .da-coin-result{min-height:62px;margin-top:0}.da-coin-result strong{display:block;font-size:23px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:6px;color:var(--muted)}

    /* Flip around Y. Front/back are now true opposing faces and never mirror the same player. */
    @keyframes daCoinFlipFront{
      0%{transform:rotateX(7deg) rotateY(0deg) rotateZ(-3deg) translateY(0) scale(1)}
      12%{transform:rotateX(4deg) rotateY(540deg) rotateZ(6deg) translateY(-42px) scale(1.025)}
      25%{transform:rotateX(-3deg) rotateY(1170deg) rotateZ(-7deg) translateY(-76px) scale(1.065)}
      38%{transform:rotateX(3deg) rotateY(1800deg) rotateZ(6deg) translateY(-84px) scale(1.075)}
      51%{transform:rotateX(-3deg) rotateY(2430deg) rotateZ(-5deg) translateY(-65px) scale(1.06)}
      64%{transform:rotateX(3deg) rotateY(3060deg) rotateZ(4deg) translateY(-38px) scale(1.04)}
      76%{transform:rotateX(-2deg) rotateY(3330deg) rotateZ(-3deg) translateY(-20px) scale(1.025)}
      87%{transform:rotateX(2deg) rotateY(3510deg) rotateZ(2deg) translateY(-8px) scale(1.012)}
      95%{transform:rotateX(1deg) rotateY(3580deg) rotateZ(-1deg) translateY(-2px) scale(1.003)}
      100%{transform:rotateX(5deg) rotateY(3600deg) rotateZ(-.5deg) translateY(0) scale(1)}
    }
    @keyframes daCoinFlipBack{
      0%{transform:rotateX(7deg) rotateY(0deg) rotateZ(-3deg) translateY(0) scale(1)}
      12%{transform:rotateX(4deg) rotateY(540deg) rotateZ(6deg) translateY(-42px) scale(1.025)}
      25%{transform:rotateX(-3deg) rotateY(1170deg) rotateZ(-7deg) translateY(-76px) scale(1.065)}
      38%{transform:rotateX(3deg) rotateY(1980deg) rotateZ(6deg) translateY(-84px) scale(1.075)}
      51%{transform:rotateX(-3deg) rotateY(2610deg) rotateZ(-5deg) translateY(-65px) scale(1.06)}
      64%{transform:rotateX(3deg) rotateY(3240deg) rotateZ(4deg) translateY(-38px) scale(1.04)}
      76%{transform:rotateX(-2deg) rotateY(3510deg) rotateZ(-3deg) translateY(-20px) scale(1.025)}
      87%{transform:rotateX(2deg) rotateY(3690deg) rotateZ(2deg) translateY(-8px) scale(1.012)}
      95%{transform:rotateX(1deg) rotateY(3760deg) rotateZ(-1deg) translateY(-2px) scale(1.003)}
      100%{transform:rotateX(5deg) rotateY(3780deg) rotateZ(-.5deg) translateY(0) scale(1)}
    }
    @keyframes daCoinSettleFront{0%{transform:rotateX(8deg) rotateY(8deg) rotateZ(-4deg) translateY(-4px)}30%{transform:rotateX(4deg) rotateY(-3deg) rotateZ(2.2deg) translateY(3px)}56%{transform:rotateX(6deg) rotateY(2deg) rotateZ(-1.1deg) translateY(-2px)}80%{transform:rotateX(5deg) rotateY(-1deg) rotateZ(.5deg) translateY(1px)}100%{transform:rotateX(5deg) rotateY(0deg) rotateZ(-.5deg) translateY(0)}}
    @keyframes daCoinSettleBack{0%{transform:rotateX(8deg) rotateY(188deg) rotateZ(-4deg) translateY(-4px)}30%{transform:rotateX(4deg) rotateY(177deg) rotateZ(2.2deg) translateY(3px)}56%{transform:rotateX(6deg) rotateY(182deg) rotateZ(-1.1deg) translateY(-2px)}80%{transform:rotateX(5deg) rotateY(179deg) rotateZ(.5deg) translateY(1px)}100%{transform:rotateX(5deg) rotateY(180deg) rotateZ(-.5deg) translateY(0)}}
    @keyframes daCoinGlint{0%{transform:translateX(-52%) rotate(5deg);opacity:.18}55%{opacity:.88}100%{transform:translateX(48%) rotate(5deg);opacity:.45}}

    @media(max-width:520px){
      .da-coin-stage{height:284px}
      .da-coin{--coin-size:196px;--coin-thickness:58px;--coin-half:29px}
      .da-coin-card{padding:24px 15px 20px}
      .da-coin-core{width:140px;height:92px;padding:10px 8px}
      .da-coin-name{width:122px;max-width:122px}
      .da-coin-rim-svg text{font-size:6.85px;letter-spacing:.88px}
      .da-coin-face:after{inset:28px}
      .da-coin-ridge-front{transform:translateZ(28px)}.da-coin-ridge-back{transform:rotateY(180deg) translateZ(28px)}
      .da-coin-front{transform:translateZ(29px)}.da-coin-back{transform:rotateY(180deg) translateZ(29px)}
    }
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function nameSize(name){
    const n=[...String(name||'')].length;
    if(n<=8)return 20;
    if(n<=11)return 18;
    if(n<=14)return 16;
    if(n<=17)return 14;
    if(n<=20)return 12.5;
    if(n<=24)return 11;
    return 9.5;
  }

  const faceHtml=(name,id)=>`<svg class="da-coin-rim-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/></defs><text textLength="260" lengthAdjust="spacingAndGlyphs"><textPath href="#${id}" startOffset="0%">DARTARENA • DARTARENA • DARTARENA •</textPath></text></svg><div class="da-coin-core"><span class="da-coin-name" style="--name-size:${nameSize(name)}px">${esc(name)}</span></div>`;

  const DEPTHS=Array.from({length:37},(_,i)=>-36+i*2);
  const depthHtml=()=>DEPTHS.map((z,i)=>`<span class="da-coin-depth-layer" style="transform:translateZ(${z}px);opacity:${(.9+(i%4)*.025).toFixed(3)}" aria-hidden="true"></span>`).join('');

  async function play({player1Id,player2Id,player1Name='Spiller 1',player2Name='Spiller 2',winnerId,duration=3300}={}){
    if(active)return;
    active=true;
    const winnerSide=winnerId===player2Id?'back':'front';
    const winnerName=winnerSide==='back'?player2Name:player1Name;
    const overlay=document.createElement('div');
    overlay.className='da-coin-overlay';
    const uid='coin'+Date.now();
    const actualDuration=Math.max(3000,Math.min(3500,Number(duration)||3300));
    overlay.innerHTML=`<section class="da-coin-card" role="dialog" aria-modal="true" aria-label="Myntkast">
      <div class="da-coin-kicker">HVEM STARTER?</div>
      <h2 class="da-coin-title">Myntkast</h2>
      <div class="da-coin-stage">
        <div class="da-coin" data-winner-side="${winnerSide}" style="--flip-duration:${actualDuration}ms">
          <div class="da-coin-depth" aria-hidden="true">${depthHtml()}</div>
          <div class="da-coin-ridge da-coin-ridge-front" aria-hidden="true"></div>
          <div class="da-coin-ridge da-coin-ridge-back" aria-hidden="true"></div>
          <div class="da-coin-face da-coin-front">${faceHtml(player1Name,uid+'front')}</div>
          <div class="da-coin-face da-coin-back">${faceHtml(player2Name,uid+'back')}</div>
        </div>
      </div>
      <div class="da-coin-result"><span>Kaster mynten…</span></div>
    </section>`;

    const coin=overlay.querySelector('.da-coin');
    const result=overlay.querySelector('.da-coin-result');
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>coin.classList.add('is-flipping'));

    await sleep(actualDuration);
    coin.classList.remove('is-flipping');
    coin.classList.add('is-settled','is-winner');
    result.innerHTML=`<strong>${esc(winnerName)} vant myntkastet</strong><span>${esc(winnerName)} starter kampen</span>`;

    await sleep(1150);
    overlay.remove();
    active=false;
  }

  window.DartArenaCoinFlip={play};
})();