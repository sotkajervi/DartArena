const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('half-it.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const source=p=>{const s=read(p);return s.slice(s.indexOf('function buildPad(){'),s.indexOf('function renderEntry(){'))};
test('Both online Half-It variants keep every control below the camera, even with 21 choices',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const mode of ['half-it-standard.js','half-it.js']){
   const page=await browser.newPage({viewport:{width:1440,height:800}});
   await page.route('**/*',async route=>{
     const u=new URL(route.request().url());
     if(u.hostname!=='dartarena.test')return route.abort();
     const file=u.pathname.slice(1);
     if(file==='half-it.html')return route.fulfill({contentType:'text/html',body:html});
     if(file.endsWith('.css')&&fs.existsSync(file))return route.fulfill({contentType:'text/css',body:read(file)});
     return route.fulfill({status:404,body:''});
   });
   await page.goto('http://dartarena.test/half-it.html');
   await page.addScriptTag({content:read('opponent-focus.js')});
   await page.addScriptTag({content:read('half-it-online-layout.js')});
   await page.addScriptTag({content:read('half-it-shortcuts.js')});
   await page.addScriptTag({content:"var $=id=>document.getElementById(id),m={status:'playing'},round={type:'number',target:20},selectedDarts=[],selectedMult=1;var currentRound=()=>round,canThrow=()=>true,addDart=()=>{};\n"+source(mode)});
   for(const [width,height] of [[1640,819],[1440,800],[1024,768],[1024,650],[390,844]]){
     await page.setViewportSize({width,height});
     for(const kind of ['number','double','treble','bull','same']){
       await page.evaluate(type=>{window.scrollTo(0,0);round={type,target:20};buildPad()},kind);
       await page.waitForFunction(()=>{const a=document.querySelector('#videoGrid').getBoundingClientRect(),b=document.querySelector('#focusInputDock').getBoundingClientRect();return a.height>0&&b.height>0&&a.bottom<=b.top+1});
       if(width>800){
         await page.waitForFunction(()=>{
           const dock=document.getElementById('focusInputDock');
           const measured=parseFloat(getComputedStyle(document.body).getPropertyValue('--half-dock-height'));
           const reserve=parseFloat(getComputedStyle(document.body).getPropertyValue('--da-x01-input-reserve'));
           return Math.abs(measured-dock.getBoundingClientRect().height-8)<2&&Math.abs(measured-reserve)<1;
         });
         const fit=await page.evaluate(()=>{
           const dock=document.getElementById('focusInputDock'),r=dock.getBoundingClientRect();
           const buttons=[...dock.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,bottom:b.getBoundingClientRect().bottom}));
           return {dockBottom:r.bottom,viewport:innerHeight,scrollY,buttons:buttons.filter(b=>b.bottom>innerHeight+1)};
         });
         assert.ok(fit.dockBottom<=fit.viewport+1&&fit.buttons.length===0&&fit.scrollY===0,JSON.stringify({mode,width,height,kind,fit}));
       }
       const metrics=await page.evaluate(()=>{
         const video=document.getElementById('videoGrid').getBoundingClientRect(),dock=document.getElementById('focusInputDock').getBoundingClientRect(),pip=document.getElementById('localVideoCard').getBoundingClientRect();
         return {videoBottom:video.bottom,dockTop:dock.top,pipBottom:pip.bottom,videoZ:getComputedStyle(document.getElementById('videoGrid')).zIndex,dockZ:getComputedStyle(document.getElementById('focusInputDock')).zIndex};
       });
       assert.ok(metrics.videoBottom<=metrics.dockTop+1,JSON.stringify({mode,width,kind,metrics}));
       assert.ok(metrics.pipBottom<=metrics.dockTop+1,JSON.stringify({mode,width,kind,metrics}));
       assert.ok(Number(metrics.dockZ)>Number(metrics.videoZ));
       if(kind==='number'){
         const keys=await page.locator('.half-quick .da-key').allTextContents();
         assert.deepEqual(keys,['1','2','3']);
         const labels=await page.locator('.half-quick .half-control-label').allTextContents();
         assert.deepEqual(labels,['SINGLE','DOBBEL','TRIPPEL']);
         const positions=await page.evaluate(()=>({hit:document.querySelector('.half-quick button').getBoundingClientRect().top,miss:document.getElementById('halfMissBtn').getBoundingClientRect().top}));
         assert.ok(Math.abs(positions.hit-positions.miss)<2);
         const btn=page.locator('.half-quick button').last();
         if(width<=800)await btn.scrollIntoViewIfNeeded();
         assert.ok(await btn.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}));
       }
     }
     await page.evaluate(()=>document.getElementById('videoGrid').classList.add('opponent-throwing'));
     await page.waitForFunction(()=>getComputedStyle(document.getElementById('focusInputDock')).display==='none');
     await page.evaluate(()=>document.getElementById('videoGrid').classList.remove('opponent-throwing'));
   }
   await page.close();
 }
 }finally{await browser.close()}
});
