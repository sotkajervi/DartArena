const fs=require('node:fs');
const assert=require('node:assert/strict');
const src=fs.readFileSync('app.js','utf8');
const url=src.match(/SUPABASE_URL='([^']+)'/)[1];
const key=src.match(/SUPABASE_KEY='([^']+)'/)[1];
const payload={email:'captcha-negative-test-20261127@example.invalid',password:'FakeTestOnly-20261127'};
(async()=>{
  for(const [label,body] of [['Missing CAPTCHA',payload],['Invalid CAPTCHA',{...payload,gotrue_meta_security:{captcha_token:'intentionally-invalid-test-token'}}]]){
    const response=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    const code=result.error_code||result.code||'none';
    console.log(label+': HTTP '+response.status+' / '+code);
    assert.ok(!response.ok,'Unexpected successful authentication');
    assert.equal(code,'captcha_failed','Expected explicit CAPTCHA rejection, not a credential or network error');
  }
})().catch(e=>{console.error(e.message);process.exitCode=1});
