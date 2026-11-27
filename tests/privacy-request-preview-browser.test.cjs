const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const filename='owner-privacy-preview.html',mime={html:'text/html',js:'application/javascript',css:'text/css',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml'};
test('Owner privacy preview access, review workflow, translation and isolation in Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  async function open(role,width=1440){
   const p=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('supabase'))return r.fulfill({contentType:'application/javascript',body:`window.mockRole=${JSON.stringify(role)};window.mockCalls=[];window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:mockRole==='guest'?null:{id:'fictional'}}}),onAuthStateChange:cb=>{window.mockAuth=cb}},rpc:async name=>{mockCalls.push(name);return {data:name==='is_owner'&&mockRole==='owner'}}})}`});
    if(u.hostname!=='dartarena.test'){external.push(u.hostname);return r.abort();}
    const file=u.pathname.slice(1);
    if(!/^[A-Za-z0-9_./-]+$/.test(file)||file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile())return r.fulfill({status:404,body:''});
    if(file===filename)return r.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8').replace(/ integrity="[^"]+" crossorigin="anonymous"/g,'')});
    return r.fulfill({contentType:mime[file.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(file)});
   });
   await p.goto('http://dartarena.test/'+filename);
   return {p,errors,external};
  }
  for(const [role,msg] of [['guest','Logg inn med Owner-kontoen.'],['player','Tilgang krever Owner.'],['admin','Tilgang krever Owner.']]){
   const {p,errors,external}=await open(role);
   await p.getByText(msg,{exact:true}).waitFor({timeout:10000});
   a.equal(await p.locator('#privacyRoom').isVisible(),false);
   await p.evaluate(()=>document.getElementById('privacyForm').dispatchEvent(new Event('submit',{cancelable:true})));
   a.equal(await p.locator('[data-request-id]').count(),0);
   a.deepEqual(errors,[]);a.deepEqual(external,[]);await p.close();
  }
  const {p,errors,external}=await open('owner',390);
  await p.locator('#privacyRoom').waitFor();
  const storage=await p.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
  await p.locator('#privacyType').selectOption('erasure');await p.locator('#privacyAdd').click();
  const card=p.locator('[data-request-id="TEST-001"]');
  a.match(await card.textContent(),/Sletting ikke tilgjengelig/);
  await p.locator('#privacyAdd').click();a.match(await p.locator('#privacyMessage').textContent(),/allerede/);
  a.equal(await p.locator('[data-request-id]').count(),1);
  await card.getByRole('button',{name:'Under behandling',exact:true}).click();
  await card.getByRole('button',{name:'Avventer avklaring',exact:true}).click();
  await card.getByRole('button',{name:'Under behandling',exact:true}).click();
  await card.getByRole('button',{name:'Avsluttet – test',exact:true}).click();
  a.match(await card.textContent(),/Mottatt → Under behandling → Avventer avklaring → Under behandling → Avsluttet – test/);
  a.equal(await card.getByRole('button').count(),0);
  await p.locator('#privacyFilter').selectOption('open');a.equal(await p.locator('[data-request-id]').count(),0);
  await p.locator('#privacyType').selectOption('access');await p.locator('#privacyAdd').click();
  a.equal(await p.locator('[data-request-id]').count(),1);
  await p.locator('#privacyFilter').selectOption('closed');a.equal(await card.count(),1);
  await p.locator('#privacyEn').click();a.match(await card.textContent(),/Erasure unavailable/);
  a.equal(await p.locator('html').getAttribute('lang'),'en');
  await p.locator('#privacyNo').click();a.match(await card.textContent(),/Sletting ikke tilgjengelig/);
  await p.locator('#privacyFilter').selectOption('all');a.equal(await p.locator('[data-request-id]').count(),2);
  await p.locator('#privacyReset').click();a.equal(await p.locator('[data-request-id]').count(),0);
  await p.locator('#privacyAdd').click();
  a.equal(await p.evaluate(()=>JSON.stringify(Object.entries(localStorage))),storage);
  a.deepEqual(await p.evaluate(()=>mockCalls),['is_owner']);
  await p.reload();await p.locator('#privacyRoom').waitFor();a.equal(await p.locator('[data-request-id]').count(),0);
  await p.locator('#privacyAdd').click();
  await p.evaluate(()=>{mockRole='guest';mockAuth('SIGNED_OUT')});await p.locator('#privacyAccess').waitFor();
  a.equal(await p.locator('#privacyRoom').isVisible(),false);a.equal(await p.locator('[data-request-id]').count(),0);
  a.deepEqual(errors,[]);a.deepEqual(external,[]);
 }finally{await browser.close()}
});