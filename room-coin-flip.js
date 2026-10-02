(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.94);backdrop-filter:blur(10px);padding:20px}
    .da-coin-card{width:min(570px,94vw);text-align:center;padding:30px 22px 25px;border:1px solid rgba(35,226,209,.28);border-radius:22px;background:linear-gradient(180deg,#091a1c,#061113);box-shadow:0 26px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.035)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.16em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 10px;font-size:clamp(27px,6vw,43px)}
    .da-coin-stage{height:322px;display:grid;place-items:center;perspective:1650px;position:relative;overflow:visible}
    .da-coin-stage:after{content:'';position:absolute;width:196px;height:34px;border-radius:50%;background:rgba(0,0,0,.62);filter:blur(14px);bottom:22px;transform:scaleX(.96);opacity:.78}

    .da-coin{--coin-size:232px;--coin-thickness:44px;--coin-radius:-111px;--edge-width:9px;position:relative;width:var(--coin-size);height:var(--coin-size);transform-style:preserve-3d;will-change:transform;z-index:2;filter:drop-shadow(0 25px 24px rgba(0,0,0,.5))}
    .da-coin.is-flipping{animation:daCoinFlipFront 3.3s cubic-bezier(.14,.7,.16,1) forwards}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}

    /* Real cylindrical side wall. Each narrow facet spans the full depth of the coin. */
    .da-coin-side{position:absolute;inset:0;transform-style:preserve-3d;pointer-events:none}
    .da-coin-side-segment{position:absolute;left:50%;top:50%;width:var(--edge-width);height:var(--coin-thickness);margin-left:calc(var(--edge-width)/-2);margin-top:calc(var(--coin-thickness)/-2);transform-style:preserve-3d;backface-visibility:visible;transform:rotateZ(var(--a)) translateY(var(--coin-radius)) rotateX(90deg);background:linear-gradient(90deg,#4d3005 0%,#946514 16%,#efd178 42%,#b37b1c 62%,#6a4308 82%,#352104 100%);border-left:1px solid rgba(35,20,1,.72);border-right:1px solid rgba(255,226,135,.14);box-shadow:inset 0 2px 4px rgba(255,244,197,.15),inset 0 -3px 5px rgba(41,24,1,.4);filter:brightness(var(--edge-light,1))}
    .da-coin-side-segment.is-groove{background:linear-gradient(90deg,#241602 0%,#5d3b08 22%,#9f711b 48%,#513106 76%,#1f1201 100%);border-left-color:rgba(12,7,0,.92);border-right-color:rgba(245,205,105,.08)}
    .da-coin-side-segment:after{content:'';position:absolute;inset:2px 1px;border-radius:2px;background:linear-gradient(180deg,rgba(255,245,207,.23),transparent 24%,transparent 72%,rgba(32,18,0,.34));opacity:.72}

    /* Face bevels hide the facet joins and make the coin read as one solid object. */
    .da-coin-bevel{position:absolute;inset:1px;border-radius:50%;box-sizing:border-box;pointer-events:none;background:transparent;border:8px solid #8a6117;box-shadow:inset 0 0 0 2px rgba(255,238,173,.38),0 0 0 1px rgba(43,26,2,.9)}
    .da-coin-bevel-front{transform:translateZ(21.5px)}
    .da-coin-bevel-back{transform:rotateX(180deg) translateZ(21.5px)}

    .da-coin-face{position:absolute;inset:5px;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;backface-visibility:hidden;overflow:hidden;border:5px solid #9c7221;background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.52) 0 2%,rgba(255,255,255,.08) 9%,transparent 19%),conic-gradient(from 18deg at 50% 50%,#aa7820,#f7dc84,#815813,#e6bc52,#69450c,#efd06f,#95671a,#f8e293,#7d5613,#d2a43b,#5d3d08,#aa7820);box-shadow:inset 0 0 0 2px rgba(255,250,216,.72),inset 0 0 0 10px rgba(72,47,5,.25),inset 11px 13px 26px rgba(255,255,255,.13),inset -13px -17px 30px rgba(48,29,1,.42),0 0 0 1px rgba(45,28,2,.88)}
    .da-coin-front{transform:translateZ(22px)}
    .da-coin-back{transform:rotateX(180deg) translateZ(22px)}

    .da-coin-face:before{content:'';position:absolute;inset:-30%;border-radius:50%;background:repeating-linear-gradient(100deg,rgba(255,255,255,.027) 0 1px,rgba(0,0,0,.028) 1px 2px),linear-gradient(112deg,transparent 34%,rgba(255,255,255,.24) 46%,rgba(255,244,187,.48) 50%,rgba(255,255,255,.12) 55%,transparent 67%);opacity:.64;transform:translateX(-29%) rotate(5deg);pointer-events:none;mix-blend-mode:soft-light}
    .da-coin.is-winner .da-coin-face:before{animation:daCoinGlint .82s ease-out both}
    .da-coin-face:after{content:'';position:absolute;inset:34px;border-radius:50%;border:1px solid rgba(73,49,8,.72);box-shadow:0 0 0 3px rgba(255,235,167,.15),0 0 0 6px rgba(76,51,7,.16),inset 0 0 22px rgba(69,44,3,.25);pointer-events:none}

    .da-coin-rim-svg{position:absolute;inset:7px;width:calc(100% - 14px);height:calc(100% - 14px);z-index:4;overflow:visible;filter:drop-shadow(0 1px rgba(255,250,210,.34))}
    .da-coin-rim-svg text{font-size:7.6px;font-weight:950;letter-spacing:1.08px;fill:#3b2705;text-transform:uppercase}

    .da-coin-core{position:relative;z-index:5;width:122px;height:122px;border-radius:50%;display:grid;place-items:center;padding:14px;box-sizing:border-box;background:radial-gradient(circle at 34% 27%,rgba(255,255,255,.23),transparent 25%),radial-gradient(circle,#d9ae4b 0,#b68429 58%,#7b5514 100%);border:2px solid rgba(78,53,8,.72);box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(255,225,137,.12)}
    .da-coin-core:before,.da-coin-core:after{content:'';position:absolute;border-radius:50%;pointer-events:none}.da-coin-core:before{inset:8px;border:1px dashed rgba(74,49,6,.36)}.da-coin-core:after{inset:17px;border:1px solid rgba(255,239,184,.12)}
    .da-coin-name{position:relative;z-index:2;max-width:94px;color:#1c1304;font-weight:1000;font-size:clamp(17px,3.7vw,22px);line-height:1.05;overflow-wrap:anywhere;letter-spacing:.005em;text-shadow:0 1px 0 rgba(255,246,205,.42),0 -1px 0 rgba(73,47,4,.16)}
    .da-coin-back .da-coin-core{box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(35,226,209,.12)}
    .da-coin-back .da-coin-name{color:#10211f;text-shadow:0 1px 0 rgba(255,246,205,.34)}

    .da-coin.is-settled{animation:daCoinSettleFront .7s cubic-bezier(.15,.82,.27,1) both}
    .da-coin[data-winner-side="back"].is-settled{animation-name:daCoinSettleBack}
    .da-coin.is-winner{filter:drop-shadow(0 0 22px rgba(35,226,209,.48)) drop-shadow(0 25px 24px rgba(0,0,0,.5))}
    .da-coin-result{min-height:62px;margin-top:1px}.da-coin-result strong{display:block;font-size:23px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:6px;color:var(--muted)}

    /* Primarily flips around X so the reeded side wall is clearly visible edge-on. */
    @keyframes daCoinFlipFront{
      0%{transform:rotateX(4deg) rotateY(-4deg) rotateZ(-3deg) translateY(0) scale(1)}
      14%{transform:rotateX(720deg) rotateY(14deg) rotateZ(7deg) translateY(-52px) scale(1.035)}
      40%{transform:rotateX(1980deg) rotateY(-13deg) rotateZ(-8deg) translateY(-82px) scale(1.075)}
      69%{transform:rotateX(3060deg) rotateY(10deg) rotateZ(5deg) translateY(-34px) scale(1.035)}
      87%{transform:rotateX(3495deg) rotateY(-5deg) rotateZ(-3deg) translateY(-9px) scale(1.012)}
      95%{transform:rotateX(3572deg) rotateY(2deg) rotateZ(1deg) translateY(-2px) scale(1.003)}
      100%{transform:rotateX(3600deg) rotateY(0deg) rotateZ(-.7deg) translateY(0) scale(1)}
    }
    @keyframes daCoinFlipBack{
      0%{transform:rotateX(4deg) rotateY(-4deg) rotateZ(-3deg) translateY(0) scale(1)}
      14%{transform:rotateX(720deg) rotateY(14deg) rotateZ(7deg) translateY(-52px) scale(1.035)}
      40%{transform:rotateX(2070deg) rotateY(-13deg) rotateZ(-8deg) translateY(-82px) scale(1.075)}
      69%{transform:rotateX(3240deg) rotateY(10deg) rotateZ(5deg) translateY(-34px) scale(1.035)}
      87%{transform:rotateX(3670deg) rotateY(-5deg) rotateZ(-3deg) translateY(-9px) scale(1.012)}
      95%{transform:rotateX(3750deg) rotateY(2deg) rotateZ(1deg) translateY(-2px) scale(1.003)}
      100%{transform:rotateX(3780deg) rotateY(0deg) rotateZ(-.7deg) translateY(0) scale(1)}
    }
    @keyframes daCoinSettleFront{0%{transform:rotateX(12deg) rotateY(-2deg) rotateZ(-4deg) translateY(-4px)}28%{transform:rotateX(3deg) rotateY(1deg) rotateZ(2.3deg) translateY(3px)}54%{transform:rotateX(8deg) rotateY(-1deg) rotateZ(-1.2deg) translateY(-2px)}78%{transform:rotateX(4deg) rotateY(.5deg) rotateZ(.6deg) translateY(1px)}100%{transform:rotateX(5deg) rotateY(0deg) rotateZ(-.6deg) translateY(0)}}
    @keyframes daCoinSettleBack{0%{transform:rotateX(192deg) rotateY(-2deg) rotateZ(-4deg) translateY(-4px)}28%{transform:rotateX(183deg) rotateY(1deg) rotateZ(2.3deg) translateY(3px)}54%{transform:rotateX(188deg) rotateY(-1deg) rotateZ(-1.2deg) translateY(-2px)}78%{transform:rotateX(184deg) rotateY(.5deg) rotateZ(.6deg) translateY(1px)}100%{transform:rotateX(185deg) rotateY(0deg) rotateZ(-.6deg) translateY(0)}}
    @keyframes daCoinGlint{0%{transform:translateX(-52%) rotate(5deg);opacity:.18}55%{opacity:.88}100%{transform:translateX(48%) rotate(5deg);opacity:.45}}

    @media(max-width:520px){.da-coin-stage{height:274px}.da-coin{--coin-size:192px;--coin-thickness:38px;--coin-radius:-91px;--edge-width:7.6px}.da-coin-card{padding:24px 15px 20px}.da-coin-core{width:101px;height:101px;padding:11px}.da-coin-name{max-width:80px;font-size:17px}.da-coin-rim-svg text{font-size:7px;letter-spacing:.92px}.da-coin-face:after{inset:28px}.da-coin-bevel-front{transform:translateZ(18.5px)}.da-coin-bevel-back{transform:rotateX(180deg) translateZ(18.5px)}.da-coin-front{transform:translateZ(19px)}.da-coin-back{transform:rotateX(180deg) translateZ(19px)}}
    @media(prefers-reduced-motion:reduce){.da-coin.is-flipping{animation-duration:.9s}.da-coin.is-settled{animation-duration:.3s}}
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const faceHtml=(name,id)=>`<svg class="da-coin-rim-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/></defs><text textLength="260" lengthAdjust="spacingAndGlyphs"><textPath href="#${id}" startOffset="0%">DARTARENA • DARTARENA • DARTARENA •</textPath></text></svg><div class="da-coin-core"><span class="da-coin-name">${esc(name)}</span></div>`;

  const SIDE_SEGMENTS=88;
  const sideHtml=()=>Array.from({length:SIDE_SEGMENTS},(_,i)=>{
    const angle=(360/SIDE_SEGMENTS)*i;
    const radians=(angle-320)*Math.PI/180;
    const light=(.72+.38*((Math.cos(radians)+1)/2)).toFixed(2);
    const groove=i%2?' is-groove':'';
    return `<span class="da-coin-side-segment${groove}" style="--a:${angle.toFixed(3)}deg;--edge-light:${light}" aria-hidden="true"></span>`;
  }).join('');

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
          <div class="da-coin-side" aria-hidden="true">${sideHtml()}</div>
          <div class="da-coin-bevel da-coin-bevel-front" aria-hidden="true"></div>
          <div class="da-coin-bevel da-coin-bevel-back" aria-hidden="true"></div>
          <div class="da-coin-face da-coin-front">${faceHtml(player1Name,uid+'a')}</div>
          <div class="da-coin-face da-coin-back">${faceHtml(player2Name,uid+'b')}</div>
        </div>
      </div>
      <div class="da-coin-result"><span>Kaster mynten…</span></div>
    </section>`;

    const coin=overlay.querySelector('.da-coin');
    const result=overlay.querySelector('.da-coin-result');
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>coin.classList.add('is-flipping'));

    await sleep(duration);
    coin.classList.remove('is-flipping');
    coin.classList.add('is-settled','is-winner');
    result.innerHTML=`<strong>${esc(winnerName)} vant myntkastet</strong><span>${esc(winnerName)} starter kampen</span>`;

    await sleep(1150);
    overlay.remove();
    active=false;
  }

  window.DartArenaCoinFlip={play};
})();