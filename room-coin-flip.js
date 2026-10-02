(()=>{
  if(window.DartArenaCoinFlip)return;

  const css=document.createElement('style');
  css.textContent=`
    .da-coin-overlay{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;background:rgba(2,8,10,.94);backdrop-filter:blur(10px);padding:20px}
    .da-coin-card{width:min(570px,94vw);text-align:center;padding:30px 22px 25px;border:1px solid rgba(35,226,209,.28);border-radius:22px;background:linear-gradient(180deg,#091a1c,#061113);box-shadow:0 26px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.035)}
    .da-coin-kicker{font-size:12px;font-weight:950;letter-spacing:.16em;color:var(--cyan);margin-bottom:8px}
    .da-coin-title{margin:0 0 8px;font-size:clamp(27px,6vw,43px)}
    .da-coin-stage{height:330px;display:grid;place-items:center;position:relative;overflow:visible}
    .da-coin-shadow{position:absolute;width:205px;height:34px;border-radius:50%;background:rgba(0,0,0,.62);filter:blur(14px);bottom:19px;opacity:.76;transform-origin:center}

    .da-coin-shell{--coin-size:240px;--coin-thickness:46px;position:relative;width:var(--coin-size);height:var(--coin-size);z-index:2;will-change:transform}
    .da-coin-face{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;overflow:hidden;border:7px solid #8c6117;background:radial-gradient(circle at 30% 23%,rgba(255,255,255,.52) 0 2%,rgba(255,255,255,.08) 9%,transparent 19%),conic-gradient(from 18deg,#9b6818,#f4d77c,#7b5110,#e9bd50,#634008,#efd06f,#8b5c14,#f8e293,#75500f,#d0a23a,#593904,#9b6818);box-shadow:inset 0 0 0 2px rgba(255,250,216,.72),inset 0 0 0 11px rgba(72,47,5,.25),inset 12px 14px 27px rgba(255,255,255,.13),inset -14px -18px 31px rgba(48,29,1,.42),0 0 0 2px rgba(45,28,2,.9),0 17px 27px rgba(0,0,0,.24);transform-origin:center;will-change:transform,opacity}
    .da-coin-face:before{content:'';position:absolute;inset:-30%;border-radius:50%;background:repeating-linear-gradient(100deg,rgba(255,255,255,.026) 0 1px,rgba(0,0,0,.03) 1px 2px),linear-gradient(112deg,transparent 34%,rgba(255,255,255,.24) 46%,rgba(255,244,187,.48) 50%,rgba(255,255,255,.12) 55%,transparent 67%);opacity:.64;transform:translateX(-29%) rotate(5deg);pointer-events:none;mix-blend-mode:soft-light}
    .da-coin-shell.is-winner .da-coin-face:before{animation:daCoinGlint .82s ease-out both}
    .da-coin-face:after{content:'';position:absolute;inset:35px;border-radius:50%;border:1px solid rgba(73,49,8,.72);box-shadow:0 0 0 3px rgba(255,235,167,.15),0 0 0 6px rgba(76,51,7,.16),inset 0 0 22px rgba(69,44,3,.25);pointer-events:none}
    .da-coin-back{opacity:0}

    .da-coin-edge{position:absolute;left:50%;top:50%;width:0;height:calc(var(--coin-size) - 12px);transform:translate(-50%,-50%);border-radius:999px/15px;box-sizing:border-box;opacity:0;overflow:hidden;border:2px solid #4d2f04;background:linear-gradient(90deg,#321d02 0%,#8e5b0d 10%,#e3b94f 24%,#76500f 39%,#f1cf6e 51%,#81550e 65%,#d5a83c 79%,#4a2b03 100%);box-shadow:inset 7px 0 10px rgba(24,13,0,.55),inset -7px 0 10px rgba(255,231,151,.22),0 10px 22px rgba(0,0,0,.28);will-change:width,opacity}
    .da-coin-edge:before{content:'';position:absolute;inset:3px 4px;border-radius:inherit;background:repeating-linear-gradient(0deg,rgba(35,20,1,.68) 0 2px,rgba(255,229,139,.34) 2px 4px,rgba(119,76,8,.42) 4px 6px);opacity:.82}
    .da-coin-edge:after{content:'';position:absolute;left:7px;right:7px;top:4px;height:24%;border-radius:50%;background:linear-gradient(180deg,rgba(255,250,219,.5),rgba(255,232,153,.08),transparent);filter:blur(2px)}

    .da-coin-rim-svg{position:absolute;inset:8px;width:calc(100% - 16px);height:calc(100% - 16px);z-index:4;overflow:visible;filter:drop-shadow(0 1px rgba(255,250,210,.34))}
    .da-coin-rim-svg text{font-size:7.25px;font-weight:950;letter-spacing:1px;fill:#3b2705;text-transform:uppercase}
    .da-coin-core{position:relative;z-index:5;width:174px;height:112px;border-radius:56%/74%;display:grid;place-items:center;padding:12px 10px;box-sizing:border-box;background:radial-gradient(circle at 34% 27%,rgba(255,255,255,.24),transparent 25%),radial-gradient(ellipse at center,#d9ae4b 0,#b68429 60%,#7b5514 100%);border:2px solid rgba(78,53,8,.72);box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(255,225,137,.12)}
    .da-coin-core:before,.da-coin-core:after{content:'';position:absolute;border-radius:50%;pointer-events:none}.da-coin-core:before{inset:8px;border:1px dashed rgba(74,49,6,.34)}.da-coin-core:after{inset:17px;border:1px solid rgba(255,239,184,.12)}
    .da-coin-name{position:relative;z-index:2;display:block;width:154px;max-width:154px;font-weight:1000;font-size:var(--name-size,15px);line-height:1;white-space:nowrap;word-break:normal;overflow-wrap:normal;overflow:hidden;text-overflow:clip;text-align:center;letter-spacing:-.025em}
    .da-coin-front .da-coin-name{color:#23e2d1;text-shadow:0 1px 1px rgba(2,17,16,.95),0 0 9px rgba(35,226,209,.32)}
    .da-coin-back .da-coin-name{color:#f7fbfb;text-shadow:0 1px 2px rgba(20,14,3,.9),0 0 7px rgba(255,255,255,.18)}
    .da-coin-back .da-coin-core{box-shadow:inset 0 0 0 2px rgba(255,235,163,.25),inset 5px 6px 14px rgba(255,255,255,.09),inset -7px -9px 16px rgba(55,34,2,.25),0 0 0 4px rgba(255,255,255,.12)}

    .da-coin-shell.is-landed{animation:daCoinLand .68s cubic-bezier(.16,.82,.25,1) both;filter:drop-shadow(0 0 23px rgba(35,226,209,.5))}
    .da-coin-result{min-height:62px;margin-top:0}.da-coin-result strong{display:block;font-size:23px;color:var(--cyan)}.da-coin-result span{display:block;margin-top:6px;color:var(--muted)}
    @keyframes daCoinLand{0%{transform:translateY(-5px) rotateZ(-3deg)}32%{transform:translateY(3px) rotateZ(2deg)}58%{transform:translateY(-2px) rotateZ(-1deg)}82%{transform:translateY(1px) rotateZ(.5deg)}100%{transform:translateY(0) rotateZ(0)}}
    @keyframes daCoinGlint{0%{transform:translateX(-52%) rotate(5deg);opacity:.18}55%{opacity:.88}100%{transform:translateX(48%) rotate(5deg);opacity:.45}}

    @media(max-width:520px){.da-coin-stage{height:286px}.da-coin-shell{--coin-size:200px;--coin-thickness:40px}.da-coin-card{padding:24px 15px 20px}.da-coin-core{width:146px;height:94px;padding:10px 8px}.da-coin-name{width:128px;max-width:128px}.da-coin-rim-svg text{font-size:6.85px;letter-spacing:.88px}.da-coin-face:after{inset:29px}}
  `;
  document.head.appendChild(css);

  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

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

  function renderProjection({shell,front,back,edge,shadow},angle,progress){
    const rad=angle*Math.PI/180;
    const cos=Math.cos(rad),sin=Math.abs(Math.sin(rad));
    const faceScale=Math.max(.018,Math.abs(cos));
    const faceOpacity=clamp((Math.abs(cos)-.02)*1.55,0,1);
    const edgeOpacity=clamp(sin*1.42,0,1);
    const thickness=parseFloat(getComputedStyle(shell).getPropertyValue('--coin-thickness'))||46;
    const edgeWidth=Math.max(0,thickness*Math.pow(sin,.72));
    const showingBack=cos<0;
    const lift=-82*Math.sin(Math.PI*progress);
    const drift=4*Math.sin(progress*Math.PI*4)*(1-progress);
    const zTilt=3.5*Math.sin(progress*Math.PI*6)*(1-progress*.65);
    shell.style.transform=`translateY(${lift+drift}px) rotateZ(${zTilt}deg)`;
    front.style.transform=`scaleX(${faceScale})`;
    back.style.transform=`scaleX(${faceScale})`;
    front.style.opacity=showingBack?'0':String(faceOpacity);
    back.style.opacity=showingBack?String(faceOpacity):'0';
    edge.style.width=`${edgeWidth}px`;
    edge.style.opacity=String(edgeOpacity);
    shadow.style.transform=`scaleX(${.68+.32*Math.abs(cos)})`;
    shadow.style.opacity=String(.34+.42*(1-progress));
  }

  function animateFlip(parts,winnerSide,duration){
    const finalAngle=winnerSide==='back'?3780:3600;
    const reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const actual=reduced?900:duration;
    return new Promise(resolve=>{
      const start=performance.now();
      function frame(now){
        const p=clamp((now-start)/actual,0,1);
        const spinP=1-Math.pow(1-p,1.16);
        const angle=finalAngle*spinP;
        renderProjection(parts,angle,p);
        if(p<1)requestAnimationFrame(frame);else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

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
        <div class="da-coin-shadow" aria-hidden="true"></div>
        <div class="da-coin-shell" data-winner-side="${winnerSide}">
          <div class="da-coin-edge" aria-hidden="true"></div>
          <div class="da-coin-face da-coin-front" data-player-id="${esc(player1Id)}">${faceHtml(player1Name,uid+'front')}</div>
          <div class="da-coin-face da-coin-back" data-player-id="${esc(player2Id)}">${faceHtml(player2Name,uid+'back')}</div>
        </div>
      </div>
      <div class="da-coin-result"><span>Kaster mynten…</span></div>
    </section>`;

    const parts={
      shell:overlay.querySelector('.da-coin-shell'),
      front:overlay.querySelector('.da-coin-front'),
      back:overlay.querySelector('.da-coin-back'),
      edge:overlay.querySelector('.da-coin-edge'),
      shadow:overlay.querySelector('.da-coin-shadow')
    };
    const result=overlay.querySelector('.da-coin-result');
    document.body.appendChild(overlay);
    renderProjection(parts,0,0);
    await animateFlip(parts,winnerSide,actualDuration);

    const finalAngle=winnerSide==='back'?180:0;
    renderProjection(parts,finalAngle,1);
    parts.shell.classList.add('is-landed','is-winner');
    result.innerHTML=`<strong>${esc(winnerName)} vant myntkastet</strong><span>${esc(winnerName)} starter kampen</span>`;

    await sleep(1150);
    overlay.remove();
    active=false;
  }

  window.DartArenaCoinFlip={play};
})();
