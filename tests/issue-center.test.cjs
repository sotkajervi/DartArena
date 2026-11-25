const test=require('node:test'),assert=require('node:assert/strict');
const {diagnostics,sanitizeEvent,contextFor}=require('../issue-center.js');
test('allowlist drops raw console text, credentials, track IDs and arbitrary data',()=>{
 const secret='Bearer PRIVATE_TOKEN https://example.com?key=PRIVATE_TOKEN';
 const raw=JSON.stringify({events:[{type:'STATE',data:{page:'match.html',mode:'sfu',local:{stream:[{kind:'video',id:secret,state:'live',enabled:true}],size:[1280,720]},placeholder:secret}},{type:'CONSOLE_ERROR',data:{message:'SFU '+secret}},{type:'MARK',data:{label:secret,detail:secret}},{type:'SCRIPT_ERROR',data:{message:secret,line:12}},{type:secret}]});
 const out=diagnostics(raw,'Mozilla Windows Chrome/130.0.0.0',null);
 assert.equal(out.events.length,4);assert.equal(out.events[0].data.local.stream[0].kind,'video');assert.equal(out.events[1].data.area,'SFU');assert.equal(out.events[2].data.label,'OTHER_MARK');assert.equal(out.events[3].data.line,12);
 assert.doesNotMatch(JSON.stringify(out),/PRIVATE_TOKEN|https:\/\/example/);assert.equal(out.browser.browser,'Chrome/130');
});
test('bad trace and huge trace are bounded',()=>{
 assert.equal(diagnostics('{','',null).mediaTraceAvailable,false);
 const out=diagnostics(JSON.stringify({events:Array.from({length:1000},()=>({type:'STATE',data:{local:{stream:Array.from({length:30},()=>({kind:'audio',state:'live'}))}}}))}),'',null);
 assert.ok(out.events.length<=120);assert.ok(JSON.stringify(out).length<=40000);
});
test('context excludes arbitrary query parameters and external script versions',()=>{
 const loc=new URL('https://example.com/match.html?id=abc&token=SECRET&mode=online');
 const d={querySelectorAll:()=>[{getAttribute:()=>'/app.js?v=20261125-v1'},{getAttribute:()=> 'https://outside.test/a?v=SECRET'}]};
 const out=contextFor(loc,d);assert.equal(out.page,'match.html');assert.equal(out.context.match_id,null);assert.deepEqual(out.context.versions,['20261125-v1']);assert.doesNotMatch(JSON.stringify(out),/SECRET/);
});
