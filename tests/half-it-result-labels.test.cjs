const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
test('Live camera names and owner badges disappear only while the result overlay is open',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const p=await browser.newPage();
 await p.setContent('<body class="match-page half-it-page own-turn-focus"><main><div class="video-grid opponent-throwing"><div class="video-card"><span class="video-name da-role-owner">Owner</span><span class="video-slot-label">Local</span></div><div class="video-card"><span class="video-name">Opponent</span></div></div></main><div id="dartArenaResultOverlay"><span class="da-result-stat-name">Owner</span></div></body>');
 for(const f of ['stable-video-labels.css','shared-results.css','half-it-online-layout.css'])await p.addStyleTag({content:fs.readFileSync(f,'utf8')});
 await p.addStyleTag({content:'body.match-page .video-name.da-role-owner{display:inline-flex!important}'});
 const states=()=>p.evaluate(()=>[...document.querySelectorAll('.video-name,.video-slot-label,.da-result-stat-name')].map(e=>({display:getComputedStyle(e).display,visible:getComputedStyle(e).visibility})));
 a.ok((await states()).every(x=>x.display!=='none'&&x.visible==='visible'));
 await p.evaluate(()=>document.body.classList.add('da-result-open'));
 const result=await states();a.ok(result.slice(0,3).every(x=>x.display==='none'&&x.visible==='hidden'));a.equal(result[3].visible,'visible');a.notEqual(result[3].display,'none');
 await p.evaluate(()=>document.body.classList.remove('da-result-open'));
 a.ok((await states()).every(x=>x.display!=='none'&&x.visible==='visible'));
 }finally{await browser.close()}
});
