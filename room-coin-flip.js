(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.94);backdrop-filter:blur(10px);padding:20px}
    .da-coin-card{width:min(570px,94vw);text-align:center;padding:30px 22px 25px;border:1px solid rgba(35,226,209,.28);border-radius:22px;background:linear-gradient(180deg,#091a1c,#061113);box-shadow:0 26px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.035)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.16em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 8px;font-size:clamp(27px,6vw,43px)}
    .da-coin-stage{height:330px;display:grid;place-items:center;perspective:1500px;position:relative;overflow:visible}
    .da-coin-stage:after{content:'';position:absolute;width:205px;height:38px;border-radius:50%;background:rgba(0,0,0,.62);filter:blur(15px);bottom:20px;transform:scaleX(.96);opacity:.78}

    .da-coin{--coin-size:236px;--coin-thickness:64px;--coin-half:32px;--coin-radius:-113px;--edge-width:8px;--flip-duration:3300ms;position:relative;width:var(--coin-size);height:var(--coin-size);transform-style:preserve-3d;will-change:transform;z-index:2;filter:drop-shadow(0 26px 25px rgba(0,0,0,.52))}
    .da-coin.is-flipping{animation:daCoinFlipFront var(--flip-duration) cubic-bezier(.14,.66,.16,1) forwards}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}

    /* Solid interior slices. These make the object visibly thick even exactly edge-on. */
    .da-coin-depth{position:absolute;inset:0;transform-style:preserve-3d;pointer-events:none}
    .da-coin-depth-layer{position:absolute;inset:4px;border-radius:50%;box-sizing:border-box;backface-visibility:visible;background:radial-gradient(circle at 35% 26%,rgba(255,236,164,.22),transparent 20%),linear-gradient(145deg,#4c3105 0%,#9a6916 24%,#e4bd5d 48%,#8e5d10 72%,#3b2403 100%);border:4px solid #70480b;box-shadow:inset 0 0 0 1px rgba(255,232,150,.17),inset 0 0 15px rgba(35,20,0,.34)}
    .da-coin-depth-layer:nth-child(odd){filter:brightness(.82)}
    .da-coin-depth-layer:nth-child(even){filter:brightness(1.03)}

    /* Reeded cylindrical wall around the solid body. */
    .da-coin-side{position:absolute;inset:0;transform-style:preserve-3d;pointer-events:none}
    .da-coin-side-segment{position:absolute;left:50%;top:50%;width:var(--edge-width);height:var(--coin-thickness);margin-left:calc(var(--edge-width)/-2);margin-top:calc(var(--coin-thickness)/-2);transform-style:preserve-3d;backface-visibility:visible;transform:rotateZ(var(--a)) translateY(var(--coin-radius)) rotateX(90deg);background:linear-gradient(90deg,#352003 0%,#6a4308 12%,#d2a13a 34%,#f3d67f 48%,#b77b1a 65%,#6c4307 84%,#2a1801 100%);border-left:1px solid rgba(20,11,0,.88);border-right:1px solid rgba(255,226,135,.2);box-shadow:inset 0 3px 5px rgba(255,244,197,.17),inset 0 -4px 6px rgba(32,18,0,.48);filter:brightness(var(--edge-light,1))}
    .da-coin-side-segment.is-groove{background:linear-gradient(90deg,#1c1001 0%,#432703 18%,#80530c 42%,#a5761a 52%,#573405 76%,#160c00 100%);border-left-color:rgba(8,4,0,.96);border-right-color:rgba(244,199,89,.08)}
    .da-coin-side-segment:after{content:'';position:absolute;inset:2px 1px;border-radius:2px;background:linear-gradient(180deg,rgba(255,248,215,.25),transparent 25%,transparent 72%,rgba(21,11,0,.42));opacity:.78}

    .da-coin-bevel{position:absolute;inset:1px;border-radius:50%;box-sizing:border-box;pointer-events:none;background:transparent;border:9px solid #875d14;box-shadow:inset 0 0 0 2px rgba(255,239,177,.38),0 0 0 1px rgba(42,24,1,.96)}
    .da-coin-bevel-front{transform:translateZ(33px)}
    .da-coin-bevel-back{transform:rotateX(180deg) translateZ(33px)}

    .da-coin-face{position:absolute;inset:5px;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;backface-visibility:hidden;overflow:hidden;border:5px solid #9c7221;background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.52) 0 2%,rgba(255,255,255,.08) 9%,transparent 19%),conic-gradient(from 18deg at 50% 50%,#aa7820,#f7dc84,#815813,#e6bc52,#69450c,#efd06f,#95671a,#f8e293,#7d5613,#d2a43b,#5d3d08,#aa7820);box-shadow:inset 0 0 0 2px rgba(255,250,216,.72),inset 0 0 0 10px rgba(72,47,5,.25),inset 11px 13px 26px rgba(255,255,255,.13),inset -13px -17px 30px rgba(48,29,1,.42),0 0 0 1px rgba(45,28,2,.88)}
    .da-coin-front{transform:translateZ(34px)}
    .da-coin-back{transform:rotateX(180deg) translateZ(34px)}
    .da-coin-face:before{content:'';position:absolute;inset:-30%;border-radius:50%;background:repeating-linear-gradient(100deg,rgba(255,255,255,.027) 0 1px,rgba(0,0,0,.028) 1px 2px),linear-gradient(112deg,transparent 34%,rgba(255,255,255,.24) 46%,rgba(255,244,187,.48) 50%,rgba(255,255,255,.12) 55%,transparent 67%);opacity:.64;transform:translateX(-29%) rotate(5deg);pointer-events:none;mix-blend-mode:soft-light}
    .da-coin.is-winner .da-coin-face:before{animation:daCoinGlint .82s ease-out both}
    .da-coin-face:after{content:'';position:absolute;inset:34px;border-radius:50%;border:1px solid rgba(73,49,8,.72);box-shadow:0 0 0 3px rgba(255,235,167,.15),0 0 0 6px rgba(76,51,7,.16),inset 0 0 22px rgba(69,44,3,.25);pointer-events:none}

    .da-coin-rim-svg{position:absolute;inset:7px;width:calc(100% - 14px);height:calc(100% - 14px);z-index:4;overflow:visible;filter:drop-shadow(0 1px rgba(255,250,210,.34))}
    .da-coin-rim-svg text{font-size:7.35px;font-weight:950;letter-spacing:1.04px;fill:#3b2705;text-transform:uppercase}

    .da-coin-core{position:relative;z-index:5;width:150px;height:112px;border-radius:50%;display:grid;place-items:center;padding:12px;box-sizing:border-box;background:radial-gradient(circle at 34% 27%,rgba(255,255,255,.24),transparent 25%),radial-gradient(ellipse at center,#d9ae4b 0,#b68429 60%,#7b5514 100%);border:2px solid rgba(78,53,8,.72);box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(255,225,137,.12)}
    .da-coin-core:before,.da-coin-core:after{content:'';position:absolute;border-radius:50%;pointer-events:none}.da-coin-core:before{inset:8px;border:1px dashed rgba(74,49,6,.34)}.da-coin-core:after{inset:17px;border:1px solid rgba(255,239,184,.12)}
    .da-coin-name{position:relative;z-index:2;display:block;max-width:128px;color:#1c1304;font-weight:1000;font-size:var(--name-size,15px);line-height:1;white-space:nowrap;word-break:normal;overflow-wrap:normal;letter-spacing:-.015em;text-shadow:0 1px 0 rgba(255,246,205,.42),0 -1px 0 rgba(73,47,4,.16)}
    .da-coin-back .da-coin-core{box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(35,226,209,.12)}
    .da-coin-back .da-coin-name{color:#10211f;text-shadow:0 1px 0 rgba(255,246,205,.34)}

    .da-coin.is-settled{animation:daCoinSettleFront .72s cubic-bezier(.15,.82,.27,1) both}
    .da-coin[data-winner-side="back"].is-settled{animation-name:daCoinSettleBack}
    .da-coin.is-winner{filter:drop-shadow(0 0 22px rgba(35,226,209,.48)) drop-shadow(0 26px 25px rgba(0,0,0,.52))}
    .da-coin-result{min-height:62px;margin-top:0}.da-coin-result strong{display:block;font-size:23px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:6px;color:var(--muted)}

    /* The spin spends more visible time near edge-on angles so the thickness reads clearly. */
    @keyframes daCoinFlipFront{
      0%{transform:rotateX(5deg) rotateY(-3deg) rotateZ(-3deg) translateY(0) scale(1)}
      12%{transform:rotateX(540deg) rotateY(5deg) rotateZ(6deg) translateY(-42px) scale(1.025)}
      25%{transform:rotateX(1170deg) rotateY(-5deg) rotateZ(-7deg) translateY(-76px) scale(1.065)}
      38%{transform:rotateX(1800deg) rotateY(4deg) rotateZ(6deg) translateY(-84px) scale(1.075)}
      51%{transform:rotateX(2430deg) rotateY(-4deg) rotateZ(-5deg) translateY(-65px) scale(1.06)}
      64%{transform:rotateX(3060deg) rotateY(3deg) rotateZ(4deg) translateY(-38px) scale(1.04)}
      76%{transform:rotateX(3330deg) rotateY(-3deg) rotateZ(-3deg) translateY(-20px) scale(1.025)}
      87%{transform:rotateX(3510deg) rotateY(2deg) rotateZ(2deg) translateY(-8px) scale(1.012)}
      95%{transform:rotateX(3580deg) rotateY(-1deg) rotateZ(-1deg) translateY(-2px) scale(1.003)}
      100%{transform:rotateX(3600deg) rotateY(0deg) rotateZ(-.5deg) translateY(0) scale(1)}
    }
    @keyframes daCoinFlipBack{
      0%{transform:rotateX(5deg) rotateY(-3deg) rotateZ(-3deg) translateY(0) scale(1)}
      12%{transform:rotateX(540deg) rotateY(5deg) rotateZ(6deg) translateY(-42px) scale(1.025)}
      25%{transform:rotateX(1170deg) rotateY(-5deg) rotateZ(-7deg) translateY(-76px) scale(1.065)}
      38%{transform:rotateX(1980deg) rotateY(4deg) rotateZ(6deg) translateY(-84px) scale(1.075)}
      51%{transform:rotateX(2610deg) rotateY(-4deg) rotateZ(-5deg) translateY(-65px) scale(1.06)}
      64%{transform:rotateX(3240deg) rotateY(3deg) rotateZ(4deg) translateY(-38px) scale(1.04)}
      76%{transform:rotateX(3510deg) rotateY(-3deg) rotateZ(-3deg) translateY(-20px) scale(1.025)}
      87%{transform:rotateX(3690deg) rotateY(2deg) rotateZ(2deg) translateY(-8px) scale(1.012)}
      95%{transform:rotateX(3760deg) rotateY(-1deg) rotateZ(-1deg) translateY(-2px) scale(1.003)}
      100%{transform:rotateX(3780deg) rotateY(0deg) rotateZ(-.5deg) translateY(0) scale(1)}
    }
    @keyframes daCoinSettleFront{0%{transform:rotateX(13deg) rotateY(-2deg) rotateZ(-4deg) translateY(-4px)}30%{transform:rotateX(3deg) rotateY(1deg) rotateZ(2.2deg) translateY(3px)}56%{transform:rotateX(8deg) rotateY(-1deg) rotateZ(-1.1deg) translateY(-2px)}80%{transform:rotateX(4deg) rotateY(.5deg) rotateZ(.5deg) translateY(1px)}100%{transform:rotateX(5deg) rotateY(0deg) rotateZ(-.5deg) translateY(0)}}
    @keyframes daCoinSettleBack{0%{transform:rotateX(193deg) rotateY(-2deg) rotateZ(-4deg) translateY(-4px)}30%{transform:rotateX(183deg) rotateY(1deg) rotateZ(2.2deg) translateY(3px)}56%{transform:rotateX(188deg) rotateY(-1deg) rotateZ(-1.1deg) translateY(-2px)}80%{transform:rotateX(184deg) rotateY(.5deg) rotateZ(.5deg) translateY(1px)}100%{transform:rotateX(185deg) rotateY(0deg) rotateZ(-.5deg) translateY(0)}}
    @keyframes daCoinGlint{0%{transform:translateX(-52%) rotate(5deg);opacity:.18}55%{opacity:.88}100%{transform:translateX(48%) rotate(5deg);opacity:.45}}

    @media(max-width:520px){
      .da-coin-stage{height:282px}
      .da-coin{--coin-size:194px;--coin-thickness:52px;--coin-half:26px;--coin-radius:-92px;--edge-width:6.7px}
      .da-coin-card{padding:24px 15px 20px}
      .da-coin-core{width:126px;height:92px;padding:10px}
      .da-coin-name{max-width:108px}
      .da-coin-rim-svg text{font-size:6.9px;letter-spacing:.9px}
      .da-coin-face:after{inset:28px}
      .da-coin-bevel-front{transform:translateZ(27px)}.da-coin-bevel-back{transform:rotateX(180deg) translateZ(27px)}
      .da-coin-front{transform:translateZ(28px)}.da-coin-back{transform:rotateX(180deg) translateZ(28px)}
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
    return 10;
  }

  const faceHtml=(name,id)=>`<svg class="da-coin-rim-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/></defs><text textLength="260" lengthAdjust="spacingAndGlyphs"><textPath href="#${id}" startOffset="0%">DARTARENA • DARTARENA • DARTARENA •</textPath></text></svg><div class="da-coin-core"><span class="da-coin-name" style="--name-size:${nameSize(name)}px">${esc(name)}</span></div>`;

  const DEPTHS=Array.from({length:17},(_,i)=>-32+i*4);
  const depthHtml=()=>DEPTHS.map((z,i)=>`<span class="da-coin-depth-layer" style="transform:translateZ(${z}px);opacity:${(.88+(i%3)*.04).toFixed(2)}" aria-hidden="true"></span>`).join('');

  const SIDE_SEGMENTS=96;
  const sideHtml=()=>Array.from({length:SIDE_SEGMENTS},(_,i)=>{
    const angle=(360/SIDE_SEGMENTS)*i;
    const radians=(angle-320)*Math.PI/180;
    const light=(.66+.46*((Math.cos(radians)+1)/2)).toFixed(2);
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
        <div class="da-coin" data-winner-side="${winnerSide}" style="--flip-duration:${Math.max(3000,Math.min(3500,Number(duration)||3300))}ms">
          <div class="da-coin-depth" aria-hidden="true">${depthHtml()}</div>
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

    const actualDuration=Math.max(3000,Math.min(3500,Number(duration)||3300));
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