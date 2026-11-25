const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8'),html=read('61-match.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
test('61 keeps X01 layout, camera PiP, timers and original scoring controls without network',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const p=await browser.newPage({viewport:{width:1440,height:800}});
 await p.route('**/*',route=>{const u=new URL(route.request().url()),f=u.pathname.slice(1);if(u.hostname!=='dartarena.test')return route.abort();if(f==='61-match.html')return route.fulfill({contentType:'text/html',body:html});if(f.endsWith('.css')&&fs.existsSync(f))return route.fulfill({contentType:'text/css',body:read(f)});return route.fulfill({status:404,body:''})});
 await p.goto('http://dartarena.test/61-match.html');
 await p.evaluate(()=>{window.originalVideo=document.getElementById('localVideo');window.originalHit=document.getElementById('hitBtn');window.hits=0;originalHit.onclick=()=>hits++;const timer=document.querySelector('.sixty-one-timer-card');const start=document.createElement('button');start.id='startTimeBtn';start.className='primary wide';start.textContent='START TID';timer.insertBefore(start,document.getElementById('pauseBtn'));});
 for(const f of ['opponent-focus.js','sixty-one-online-layout.js','sixty-one-shortcuts.js'])await p.addScriptTag({content:read(f)});
 for(const [width,height] of [[1640,819],[1440,800],[1024,650],[390,844]]){
  await p.setViewportSize({width,height});
  await p.waitForFunction(()=>{const v=document.getElementById('videoGrid').getBoundingClientRect(),d=document.getElementById('focusInputDock').getBoundingClientRect();return v.height>0&&d.height>0&&v.bottom<=d.top+1});
  const metrics=await p.evaluate(()=>{const box=id=>document.getElementById(id).getBoundingClientRect();return {video:box('videoGrid').bottom,dock:box('focusInputDock').top,pip:box('localVideoCard').bottom,hit:box('hitBtn').bottom,start:box('startTimeBtn').bottom,pause:box('pauseBtn').bottom,clock:box('clock').height,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,same:originalVideo===document.getElementById('localVideo')&&originalHit===document.getElementById('hitBtn')}});
  a.ok(metrics.same&&metrics.clock>0&&metrics.pip<=metrics.dock+1&&metrics.scrollWidth<=width+1,JSON.stringify(metrics));
  if(width>800){a.ok(metrics.hit<=height+1&&metrics.start<=height+1&&metrics.pause<=height+1,JSON.stringify(metrics))}
  await p.evaluate(()=>document.getElementById('videoGrid').classList.add('opponent-throwing'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('focusInputDock')).display==='none');
  a.ok(await p.locator('#startTimeBtn').isVisible());a.ok(await p.locator('#pauseBtn').isVisible());a.ok(await p.locator('#undoBtn').isVisible());
  await p.evaluate(()=>document.getElementById('videoGrid').classList.remove('opponent-throwing'));
  await p.waitForFunction(()=>getComputedStyle(document.getElementById('focusInputDock')).display!=='none');
 }
 await p.keyboard.press('Enter');a.equal(await p.evaluate(()=>hits),1);
 await p.locator('#sixtyOneHistoryButton').click();await p.keyboard.press('Enter');a.equal(await p.evaluate(()=>hits),1);await p.keyboard.press('Escape');a.equal(await p.locator('#sixtyOneHistoryDialog').evaluate(e=>e.open),false);
 }finally{await browser.close()}
});
