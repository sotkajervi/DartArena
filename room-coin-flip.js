(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.94);backdrop-filter:blur(10px);padding:20px}
    .da-coin-card{width:min(560px,94vw);text-align:center;padding:30px 22px 25px;border:1px solid rgba(35,226,209,.28);border-radius:22px;background:linear-gradient(180deg,#091a1c,#061113);box-shadow:0 26px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.035)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.16em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 14px;font-size:clamp(27px,6vw,43px)}
    .da-coin-stage{height:305px;display:grid;place-items:center;perspective:1450px;position:relative;overflow:visible}
    .da-coin-stage:after{content:'';position:absolute;width:184px;height:34px;border-radius:50%;background:rgba(0,0,0,.58);filter:blur(13px);bottom:20px;transform:scaleX(.94);opacity:.76}

    .da-coin{--land-y:0deg;position:relative;width:228px;height:228px;transform-style:preserve-3d;will-change:transform;z-index:2;filter:drop-shadow(0 24px 22px rgba(0,0,0,.48))}
    .da-coin.is-flipping{animation:daCoinFlip 3.3s cubic-bezier(.13,.73,.18,1) forwards}
    .da-coin[data-winner-side="back"].is-flipping{animation-name:daCoinFlipBack}

    /* Thick stacked metal body: 48px total depth. Each slice carries the reeded edge. */
    .da-coin-edge-layer{position:absolute;inset:2px;border-radius:50%;box-sizing:border-box;background:
      repeating-conic-gradient(from .8deg,
        #392707 0 1.3deg,
        #8e6a20 1.3deg 2.4deg,
        #f0d17a 2.4deg 3.25deg,
        #6f5016 3.25deg 4.45deg,
        #c99d3d 4.45deg 5.45deg,
        #4b3409 5.45deg 6.6deg);
      border:2px solid rgba(55,34,4,.9);box-shadow:inset 0 0 7px rgba(255,229,146,.28),inset 0 0 20px rgba(39,23,0,.52)}
    .da-coin-edge-layer:before{content:'';position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,247,205,.22) 0 .55deg,rgba(0,0,0,.25) .55deg 1.25deg,transparent 1.25deg 2.5deg);mix-blend-mode:overlay;opacity:.95}
    .da-coin-edge-layer:after{content:'';position:absolute;inset:7px;border-radius:50%;border:1px solid rgba(255,226,125,.12);box-shadow:0 0 0 2px rgba(49,31,3,.18)}

    .da-coin-face{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;backface-visibility:hidden;overflow:hidden;border:7px solid #8f6b20;background:
      radial-gradient(circle at 31% 24%,rgba(255,255,255,.5) 0 1.8%,rgba(255,255,255,.08) 8%,transparent 18%),
      conic-gradient(from 18deg at 50% 50%,#b4832a,#f6dd8c,#8e651b,#e6bf5d,#755014,#f0d17a,#a87924,#f7e39c,#8c641a,#d5aa45,#6c4a10,#b4832a);
      box-shadow:inset 0 0 0 2px rgba(255,250,216,.72),inset 0 0 0 11px rgba(72,47,5,.30),inset 11px 13px 26px rgba(255,255,255,.14),inset -13px -17px 30px rgba(48,29,1,.42),0 0 0 1px rgba(45,28,2,.9)}
    .da-coin-front{transform:translateZ(26px)}
    .da-coin-back{transform:rotateY(180deg) translateZ(26px)}

    /* Brushed-metal grain + animated specular glint. */
    .da-coin-face:before{content:'';position:absolute;inset:-30%;border-radius:50%;background:
      repeating-linear-gradient(100deg,rgba(255,255,255,.026) 0 1px,rgba(0,0,0,.028) 1px 2px),
      linear-gradient(112deg,transparent 35%,rgba(255,255,255,.28) 47%,rgba(255,244,187,.46) 50%,rgba(255,255,255,.12) 54%,transparent 66%);
      opacity:.62;transform:translateX(-28%) rotate(5deg);pointer-events:none;mix-blend-mode:soft-light}
    .da-coin.is-winner .da-coin-face:before{animation:daCoinGlint .8s ease-out both}
    .da-coin-face:after{content:'';position:absolute;inset:35px;border-radius:50%;border:1px solid rgba(73,49,8,.72);box-shadow:0 0 0 3px rgba(255,235,167,.16),0 0 0 6px rgba(76,51,7,.18),inset 0 0 22px rgba(69,44,3,.26);pointer-events:none}

    .da-coin-rim-svg{position:absolute;inset:7px;width:calc(100% - 14px);height:calc(100% - 14px);z-index:4;overflow:visible;filter:drop-shadow(0 1px rgba(255,250,210,.34))}
    .da-coin-rim-svg text{font-size:7.8px;font-weight:950;letter-spacing:1.15px;fill:#3d2906;text-transform:uppercase}

    .da-coin-core{position:relative;z-index:5;width:122px;height:122px;border-radius:50%;display:grid;place-items:center;padding:14px;box-sizing:border-box;background:
      radial-gradient(circle at 34% 27%,rgba(255,255,255,.22),transparent 25%),
      radial-gradient(circle,#d7ad4b 0,#b8872c 58%,#805b17 100%);
      border:2px solid rgba(78,53,8,.72);box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(255,225,137,.12)}
    .da-coin-core:before,.da-coin-core:after{content:'';position:absolute;border-radius:50%;pointer-events:none}
    .da-coin-core:before{inset:8px;border:1px dashed rgba(74,49,6,.36)}
    .da-coin-core:after{inset:17px;border:1px solid rgba(255,239,184,.12)}
    .da-coin-name{position:relative;z-index:2;max-width:94px;color:#1c1304;font-weight:1000;font-size:clamp(17px,3.7vw,22px);line-height:1.05;overflow-wrap:anywhere;letter-spacing:.005em;text-shadow:0 1px 0 rgba(255,246,205,.42),0 -1px 0 rgba(73,47,4,.16)}
    .da-coin-back .da-coin-core{box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(35,226,209,.10)}
    .da-coin-back .da-coin-name{color:#10211f;text-shadow:0 1px 0 rgba(255,246,205,.34)}

    .da-coin.is-settled{animation:daCoinSettle .68s cubic-bezier(.15,.82,.27,1) both}
    .da-coin.is-winner{filter:drop-shadow(0 0 20px rgba(35,226,209,.46)) drop-shadow(0 24px 22px rgba(0,0,0,.48))}
    .da-coin-result{min-height:62px;margin-top:3px}.da-coin-result strong{display:block;font-size:23px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:6px;color:var(--muted)}

    @keyframes daCoinFlip{
      0%{transform:rotateX(10deg) rotateY(0) rotateZ(-2deg) translateY(0) scale(1)}
      13%{transform:rotateX(126deg) rotateY(690deg) rotateZ(8deg) translateY(-52px) scale(1.035)}
      43%{transform:rotateX(318deg) rotateY(2240deg) rotateZ(-9deg) translateY(-78px) scale(1.075)}
      72%{transform:rotateX(474deg) rotateY(3220deg) rotateZ(6deg) translateY(-31px) scale(1.035)}
      90%{transform:rotateX(386deg) rotateY(3532deg) rotateZ(-3deg) translateY(-8px) scale(1.01)}
      100%{transform:rotateX(368deg) rotateY(3600deg) rotateZ(-1deg) translateY(0) scale(1)}
    }
    @keyframes daCoinFlipBack{
      0%{transform:rotateX(10deg) rotateY(0) rotateZ(-2deg) translateY(0) scale(1)}
      13%{transform:rotateX(126deg) rotateY(690deg) rotateZ(8deg) translateY(-52px) scale(1.035)}
      43%{transform:rotateX(318deg) rotateY(2240deg) rotateZ(-9deg) translateY(-78px) scale(1.075)}
      72%{transform:rotateX(474deg) rotateY(3280deg) rotateZ(6deg) translateY(-31px) scale(1.035)}
      90%{transform:rotateX(386deg) rotateY(3702deg) rotateZ(-3deg) translateY(-8px) scale(1.01)}
      100%{transform:rotateX(368deg) rotateY(3780deg) rotateZ(-1deg) translateY(0) scale(1)}
    }
    @keyframes daCoinSettle{
      0%{transform:rotateX(15deg) rotateY(var(--land-y)) rotateZ(-4deg) translateY(-4px)}
      28%{transform:rotateX(6deg) rotateY(var(--land-y)) rotateZ(2.2deg) translateY(3px)}
      52%{transform:rotateX(11deg) rotateY(var(--land-y)) rotateZ(-1.2deg) translateY(-2px)}
      76%{transform:rotateX(8deg) rotateY(var(--land-y)) rotateZ(.6deg) translateY(1px)}
      100%{transform:rotateX(9deg) rotateY(var(--land-y)) rotateZ(-.7deg) translateY(0)}
    }
    @keyframes daCoinGlint{0%{transform:translateX(-52%) rotate(5deg);opacity:.18}55%{opacity:.85}100%{transform:translateX(48%) rotate(5deg);opacity:.45}}

    @media(max-width:520px){.da-coin-stage{height:255px}.da-coin{width:188px;height:188px}.da-coin-card{padding:24px 15px 20px}.da-coin-core{width:101px;height:101px;padding:11px}.da-coin-name{max-width:80px;font-size:17px}.da-coin-rim-svg text{font-size:7.2px;letter-spacing:.95px}.da-coin-face:after{inset:29px}}
    @media(prefers-reduced-motion:reduce){.da-coin.is-flipping{animation-duration:.9s}.da-coin.is-settled{animation-duration:.3s}}
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const faceHtml=(name,id)=>`<svg class="da-coin-rim-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50,50 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0"/></defs><text textLength="260" lengthAdjust="spacingAndGlyphs"><textPath href="#${id}" startOffset="0%">DARTARENA • DARTARENA • DARTARENA •</textPath></text></svg><div class="da-coin-core"><span class="da-coin-name">${esc(name)}</span></div>`;

  const EDGE_DEPTHS=[-24,-20,-16,-12,-8,-4,0,4,8,12,16,20,24];
  const edgeHtml=()=>EDGE_DEPTHS.map((z,i)=>{
    const brightness=(.77+(i/(EDGE_DEPTHS.length-1))*.35).toFixed(2);
    return `<div class="da-coin-edge-layer" aria-hidden="true" style="transform:translateZ(${z}px);filter:brightness(${brightness})"></div>`;
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
          ${edgeHtml()}
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
    coin.style.setProperty('--land-y',winnerSide==='back'?'180deg':'0deg');
    coin.classList.add('is-settled','is-winner');
    result.innerHTML=`<strong>${esc(winnerName)} vant myntkastet</strong><span>${esc(winnerName)} starter kampen</span>`;

    await sleep(1100);
    overlay.remove();
    active=false;
  }

  window.DartArenaCoinFlip={play};
})();