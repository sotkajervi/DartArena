const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');

test('report opt-in, opt-out, retry, staff access, download and status in Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith('https://issue.invalid/')?route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><div id="lobbyStatsActions"></div><video id="localVideo"></video></body></html>'}):route.abort());
 await page.goto('https://issue.invalid/match.html?id=11111111-1111-4111-8111-111111111111');
 await page.evaluate(()=>{
   localStorage.setItem('dartarena-language','en');
   sessionStorage.setItem('dartarena-media-trace-v1',JSON.stringify({events:[{type:'CONSOLE_ERROR',data:{message:'SFU PRIVATE_SECRET'}},{type:'STATE',data:{page:'match.html',local:{stream:[{kind:'video',id:'PRIVATE_SECRET',state:'live'}]}}}]}));
   window.mock={rows:[],admin:false,fail:false,listener:null};
   window.DartArenaSupabaseClient={
     auth:{getSession:async()=>({data:{session:{user:{id:'user-1'}}}}),onAuthStateChange:fn=>{window.mock.listener=fn}},
     rpc:async()=>({data:window.mock.admin}),
     from:()=>({
       insert:async payload=>{if(window.mock.fail)return {error:{code:'NETWORK'}};window.mock.rows.push({...payload,id:'report-'+window.mock.rows.length,user_id:'user-1',created_at:new Date().toISOString(),status:'new',internal_note:''});return {error:null}},
       select:()=>{let id=null,filter=null;const q={order:()=>q,limit:()=>q,eq:(k,v)=>{if(k==='id')id=v;else filter=v;return q},single:async()=>({data:window.mock.rows.find(r=>r.id===id)}),then:(resolve,reject)=>Promise.resolve({data:window.mock.rows.filter(r=>!filter||r.status===filter)}).then(resolve,reject)};return q},
       update:payload=>({eq:(k,id)=>({select:async()=>{const r=window.mock.rows.find(r=>r.id===id);Object.assign(r,payload);return {data:[{id}]}}})})
     })
   };
 });
 await page.addScriptTag({path:path.join(__dirname,'../issue-center.js')});
 const launch=page.locator('#daIssueReportBtn');
 await launch.click();
 let modal=page.locator('dialog[open]');
 await modal.getByRole('textbox').fill('Opt-out report');
 assert.equal(await modal.getByRole('checkbox').isChecked(),false);
 await modal.getByRole('button',{name:'Submit report'}).click();
 await modal.getByText('Report submitted. Thank you!').waitFor();
 assert.equal(await page.evaluate(()=>mock.rows[0].diagnostics),null);
 await modal.getByRole('button',{name:'Close'}).click();
 await launch.click();
 await modal.getByRole('textbox').fill('Opt-in report');
 await modal.getByRole('checkbox').check();
 await page.evaluate(()=>mock.fail=true);
 await modal.getByRole('button',{name:'Submit report'}).click();
 await modal.getByText('Could not submit. Your text is preserved – try again.').waitFor();
 assert.equal(await modal.getByRole('textbox').inputValue(),'Opt-in report');
 await page.evaluate(()=>mock.fail=false);
 await modal.getByRole('button',{name:'Submit report'}).click();
 await modal.getByText('Report submitted. Thank you!').waitFor();
 const saved=await page.evaluate(()=>mock.rows[1]);
 assert.equal(saved.context.match_id,'11111111-1111-4111-8111-111111111111');
 assert.equal(saved.diagnostics.mediaTraceAvailable,true);
 assert.doesNotMatch(JSON.stringify(saved.diagnostics),/PRIVATE_SECRET/);
 await modal.getByRole('button',{name:'Close'}).click();
 assert.equal(await page.locator('#daIssueAdminBtn').count(),0);
 await page.evaluate(()=>{mock.admin=true;mock.listener()});
 await page.locator('#daIssueAdminBtn').click();
 const row=modal.locator('.da-issue-row').filter({hasText:'Opt-in report'});
 await row.getByRole('button',{name:'Open'}).click();
 const dl=page.waitForEvent('download');
 await row.getByRole('button',{name:'Download diagnostics'}).click();
 assert.match((await dl).suggestedFilename(),/^dartarena-issue-/);
 await row.getByRole('combobox').selectOption('resolved');
 await row.getByRole('textbox').fill('Verified');
 await row.getByRole('button',{name:'Save'}).click();
 await row.getByText('Video / camera · resolved').waitFor();
 assert.equal(await page.evaluate(()=>mock.rows[1].internal_note),'Verified');
 await modal.getByRole('button',{name:'Close'}).click();
 await page.evaluate(()=>{localStorage.setItem('dartarena-language','no');window.dispatchEvent(new Event('storage'))});
 await launch.click();
 await modal.getByRole('heading',{name:'Rapporter et problem'}).waitFor();
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
