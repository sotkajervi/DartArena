const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const routes=['match.html','cricket.html','half-it.html','61-match.html','jdc-match.html','room.html'];
test('All online entry points, including same-page Cricket and Pentathlon room, load fresh shared CSS',()=>{
 for(const p of routes)a.match(fs.readFileSync(p,'utf8'),/shared-results\.css\?v=20261125-final-surface1/,p);
});
test('Live camera name labels are hidden on every online final screen, but not live or between legs',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const p=await browser.newPage();
 const cases=[
 ['X01','match-page own-turn-focus','.video-name','video-name da-role-owner','video-card'],
 ['Cricket','match-page opponent-focus','.video-name','video-name','video-card'],
 ['Half-It Standard','match-page half-it-page own-turn-focus','.video-name','video-name da-role-owner','video-card'],
 ['Half-It DartCounter','match-page half-it-page opponent-focus','.video-name','video-name','video-card'],
 ['61','match-page sixty-one-match-page','.video-slot-label','video-slot-label da-role-owner','video-slot'],
 ['JDC','jdc-match-page','.jdc-video-slot-label','jdc-video-slot-label','jdc-video-slot'],
 ['Pentathlon','pt-online-test match-page','.video-name','video-name da-role-owner','video-card']
 ];
 for(const [name,cls,selector,label,wrapper] of cases){
  await p.setContent('<body class="'+cls+'"><main><div class="video-grid opponent-throwing"><div class="'+wrapper+'"><span class="'+label+'">A</span></div><div class="'+wrapper+'"><span class="'+label+'">B</span></div></div></main><div id="dartArenaResultOverlay"><span class="da-result-stat-name">A</span></div><div id="ptStageOverlay" hidden><div id="ptFinished" hidden></div></div></body>');
  for(const f of ['shared-results.css','stable-video-labels.css','sixty-one-video-name-bar.css','jdc-stable-names.css'])await p.addStyleTag({content:fs.readFileSync(f,'utf8')});
  await p.addStyleTag({content:'body.match-page .video-name.da-role-owner,body.match-page .video-slot-label.da-role-owner{display:inline-flex!important}'});
  const states=()=>p.evaluate(sel=>[...document.querySelectorAll(sel+',.da-result-stat-name')].map(e=>({display:getComputedStyle(e).display,visible:getComputedStyle(e).visibility})),selector);
  const live=await states();a.equal(live.length,3,name);a.ok(live.every(x=>x.display!=='none'&&x.visible==='visible'),name);
  if(name==='Pentathlon'){
   await p.evaluate(()=>document.getElementById('ptStageOverlay').hidden=false);
   a.ok((await states()).every(x=>x.display!=='none'&&x.visible==='visible'),'stage review');
   await p.evaluate(()=>document.getElementById('ptFinished').hidden=false);
  }else await p.evaluate(()=>document.body.classList.add('da-result-open'));
  const result=await states();a.ok(result.slice(0,2).every(x=>x.display==='none'&&x.visible==='hidden'),name);a.equal(result[2].visible,'visible',name);a.notEqual(result[2].display,'none',name);
  await p.evaluate(()=>{document.body.classList.remove('da-result-open');document.getElementById('ptStageOverlay').hidden=true;document.getElementById('ptFinished').hidden=true});
  a.ok((await states()).every(x=>x.display!=='none'&&x.visible==='visible'),name);
 }
 }finally{await browser.close()}
});

test('Final overlay hides all live scoreboard text even when late stable name CSS forces visibility',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const p=await browser.newPage();
  for(const pentathlon of [false,true]){
   await p.setContent('<body class="match-page sixty-one-match-page own-turn-focus '+(pentathlon?'pt-online-test':'')+'"><main><section id="matchView"><span class="match-name">Player A</span><span class="sixty-one-player-name">Player B</span><span class="turn-text">A vant kampen</span><span id="extraLive">Other live text</span></section></main><div id="'+(pentathlon?'ptStageOverlay':'dartArenaResultOverlay')+'"><section id="ptFinished"><span class="match-name da-result-stat-name">Result name</span></section></div></body>');
   for(const f of ['shared-results.css','stable-player-names.css','stable-video-labels.css'])await p.addStyleTag({content:fs.readFileSync(f,'utf8')});
   await p.addStyleTag({content:'#extraLive{visibility:visible!important;opacity:1!important}'});
   const measure=()=>p.evaluate(()=>({main:getComputedStyle(document.querySelector('main')).opacity,live:[...document.querySelectorAll('main .match-name,main .sixty-one-player-name,main .turn-text')].map(e=>getComputedStyle(e).visibility),result:getComputedStyle(document.querySelector('.da-result-stat-name')).visibility,resultOpacity:getComputedStyle(document.querySelector('.da-result-stat-name')).opacity}));
   const live=await measure();a.equal(live.main,'1');a.ok(live.live.every(x=>x==='visible'));
   await p.evaluate(()=>document.body.classList.add('da-result-open'));
   const final=await measure();a.equal(final.main,'0');a.ok(final.live.every(x=>x==='hidden'));a.equal(final.result,'visible');a.equal(final.resultOpacity,'1');
   await p.evaluate(()=>document.body.classList.remove('da-result-open'));a.deepEqual(await measure(),live);
  }
 }finally{await browser.close()}
});
