const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const mime={html:'text/html',js:'application/javascript',css:'text/css',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml'};
test('Owner SEER simulation and ordinary 501 remain isolated in Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  async function open(file,allowed){
   const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('supabase'))return r.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'owner-test'}}}),onAuthStateChange:cb=>{window.mockAuth=cb}},rpc:async name=>({data:name==='is_owner'&&${allowed===true}})})}`});
    if(u.hostname!=='dartarena.test')return r.abort();
    const p=u.pathname.slice(1);
    if(!/^[A-Za-z0-9_./-]+$/.test(p)||p.includes('..')||!fs.existsSync(p)||!fs.statSync(p).isFile())return r.fulfill({status:404,body:''});
    if(p==='practice-cloud.js'||p==='role-visuals.js')return r.fulfill({contentType:'application/javascript',body:''});
    return r.fulfill({contentType:mime[p.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(p)});
   });
   // Mocked Supabase response differs from the real SRI-pinned script. Only in this isolated browser remove its SRI.
   await page.route('**/'+file,async r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8').replace(/ integrity="[^"]+" crossorigin="anonymous"/g,'')}));
   await page.goto('http://dartarena.test/'+file);
   return {page,errors};
  }
  let {page:p,errors}=await open('owner-seer-local-501.html',false);
  await p.getByText('Tilgang krever Owner.',{exact:true}).waitFor({timeout:10000}).catch(async e=>{throw Error('Owner denial not displayed: '+JSON.stringify({status:await p.locator('#seerLocalAccess').textContent(),errors})+'; '+e.message)});
  a.equal(await p.locator('#seerLocalRoom').isVisible(),false);
  a.equal(await p.locator('script[src*="local-h2h.js"]').count(),0);
  a.deepEqual(errors,[]);await p.close();
  ({page:p,errors}=await open('owner-seer-local-501.html',true));
  await p.locator('#localSetupForm').waitFor();
  await p.locator('#localName1').fill('SEER A');await p.locator('#localName2').fill('SEER B');
  await p.locator('#localBestOf').selectOption('1');await p.locator('#localStarter').selectOption('0');
  await p.locator('#localSetupForm button[type="submit"]').click();
  await p.locator('#seerLocalPanel').waitFor();
  for(let i=1;i<=3;i++)await p.locator('#seerLocalDart'+i).selectOption('T20');
  await p.locator('#seerLocalPreview').click();a.match(await p.locator('#seerLocalStatus').textContent(),/180/);
  await p.locator('#seerLocalConfirm').click();
  await p.waitForFunction(()=>document.getElementById('localScore0').textContent==='321');
  a.match(await p.locator('#localTurn').textContent(),/SEER B/);
  a.equal(await p.locator('#seerLocalConfirm').isDisabled(),true);
  await p.locator('#localScoreInput').fill('100');await p.locator('#localSubmit').click();
  await p.waitForFunction(()=>document.getElementById('localScore1').textContent==='401');
  await p.locator('#localUndo').click();await p.waitForFunction(()=>document.getElementById('localScore1').textContent==='501');
  a.equal(await p.evaluate(()=>localStorage.getItem('dartarena-local-h2h-state-v1')),null);
  a.equal(await p.evaluate(()=>localStorage.getItem('dartarena-local-h2h-bot-session-v1')),null);
  await p.evaluate(()=>window.mockAuth('SIGNED_OUT'));
  await p.locator('#seerLocalAccess').waitFor();a.equal(await p.locator('#seerLocalRoom').isVisible(),false);
  a.deepEqual(errors,[]);await p.close();
  ({page:p,errors}=await open('local-head-to-head.html',false));
  await p.locator('#localSetupForm').waitFor();
  await p.locator('#localName1').fill('A');await p.locator('#localName2').fill('B');await p.locator('#localStarter').selectOption('0');
  await p.locator('#localSetupForm button[type="submit"]').click();
  await p.locator('#localScoreInput').fill('100');await p.locator('#localSubmit').click();
  await p.waitForFunction(()=>document.getElementById('localScore0').textContent==='401');
  a.equal(await p.locator('#seerLocalPanel').count(),0);
  a.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('dartarena-local-h2h-state-v1')).scores[0]),401);
  a.deepEqual(errors,[]);
 }finally{await browser.close();}
});
