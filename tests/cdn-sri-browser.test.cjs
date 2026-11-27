'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const URL_PIN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
const HASH='sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';
const pages=require('node:child_process').execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(name=>name.endsWith('.html'));
const expected='<script src="'+URL_PIN+'" integrity="'+HASH+'" crossorigin="anonymous">';
test('all tracked HTML Supabase scripts use the verified SDK; Chromium enforces SRI',async()=>{
  let count=0;
  for(const name of pages){
    const html=fs.readFileSync(name,'utf8');
    const tags=html.match(/<script\b[^>]*src=["'][^"']*supabase-js[^"']*["'][^>]*>/gi)||[];
    for(const tag of tags){
      assert.ok(tag.includes('src="'+URL_PIN+'"'),name+' URL');
      assert.ok(tag.includes('integrity="'+HASH+'"'),name+' integrity');
      assert.ok(tag.includes('crossorigin="anonymous"'),name+' crossorigin');
      count++;
    }
  }
  assert.ok(count>=37,'expected at least 37 protected references, found '+count);
  console.log('Verified protected Supabase references: '+count);
  // Only the extracted SDK script is executed, not the app or production APIs.
  const wrong=HASH.slice(0,-1)+(HASH.endsWith('A')?'B':'A');
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const tag=req.url==='/bad'?expected.replace(HASH,wrong):expected;
    res.end('<!doctype html><meta charset="utf-8"><script>window.sriState="pending"</script>'+tag.replace(/>$/,' onload="window.sriState=\'loaded\'" onerror="window.sriState=\'blocked\'">')+'</script>');
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    const origin='http://127.0.0.1:'+server.address().port;
    for(const [path,state] of [['/good','loaded'],['/bad','blocked']]){
      const context=await browser.newContext({serviceWorkers:'block'});
      try{
        await context.route('**/*',route=>{
          const u=route.request().url();
          return u===URL_PIN||u.startsWith(origin+'/')?route.continue():route.abort();
        });
        const page=await context.newPage();
        await page.goto(origin+path,{waitUntil:'load',timeout:45000});
        await page.waitForFunction(()=>window.sriState!=='pending',{},{timeout:15000});
        const result=await page.evaluate(()=>({state:window.sriState,sdk:typeof window.supabase?.createClient}));
        assert.equal(result.state,state);
        assert.equal(result.sdk,state==='loaded'?'function':'undefined');
      }finally{await context.close();}
    }
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
