'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const sdk=require('@supabase/supabase-js');
const source=fs.readFileSync('supabase/functions/autoscoring-roboflow/index.ts','utf8');
assert.match(source,/npm:@supabase\/supabase-js@2\.119\.2/);
const code=ts.transpileModule(source.replace(/^import "jsr:[^"]+";\s*/,'').replace('npm:@supabase/supabase-js@2.119.2','@supabase/supabase-js'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const token='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.dGVzdA';
const jpeg=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(120)]).toString('base64');
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function harness({auth=true,admin=true,quota=true}={}){
  let handler;const calls=[];const env={SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'test-anon',ROBOFLOW_API_KEY:'test-private'};
  const fakeFetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    const headers=new Headers(init?.headers??input?.headers);
    calls.push({host:url.hostname,path:url.pathname,auth:headers.get('authorization')});
    if(url.hostname==='test.invalid'){
      assert.equal(headers.get('authorization'),'Bearer '+token);
      if(url.pathname==='/auth/v1/user')return auth?json({id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}):json({message:'invalid token'},401);
      if(url.pathname==='/rest/v1/rpc/is_admin')return json(admin);
      if(url.pathname==='/rest/v1/rpc/autoscoring_roboflow_consume_quota')return json(quota);
    }
    if(url.hostname==='serverless.roboflow.com')return json({image:{width:640,height:480},predictions:[{class:'dart',keypoints:[{x:100,y:200,confidence:.8,class_name:'tip'}]}]});
    throw new Error('Unexpected mocked URL '+url.hostname+url.pathname);
  };
  const sandbox={exports:{},require(name){assert.equal(name,'@supabase/supabase-js');return {...sdk,createClient(url,key,options){return sdk.createClient(url,key,{...options,global:{...options.global,fetch:fakeFetch}})}}},Deno:{serve(fn){handler=fn},env:{get(key){return env[key]}}},fetch:fakeFetch,Response,Request,Headers,URL,AbortSignal,atob,console};
  vm.runInNewContext(code,sandbox,{filename:'roboflow-edge.js'});
  return {calls,request:(method='POST',jwt=token,body={image:jpeg})=>handler(new Request('https://edge.invalid',{method,headers:jwt?{authorization:'Bearer '+jwt,'content-type':'application/json'}:{},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}
test('missing and rejected JWT never call inference',async()=>{const h=harness({auth:false});assert.equal((await h.request('POST','')).status,401);assert.equal(h.calls.length,0);assert.equal((await h.request()).status,401);assert.deepEqual(h.calls.map(c=>c.path),['/auth/v1/user']);});
test('non-admin and exhausted quota are rejected before inference',async()=>{const a=harness({admin:false});assert.equal((await a.request()).status,403);assert.equal(a.calls.length,2);const q=harness({quota:false});assert.equal((await q.request()).status,429);assert.equal(q.calls.length,3);});
test('valid admin request consumes quota then returns normalized detection',async()=>{const h=harness();const r=await h.request();assert.equal(r.status,200);assert.deepEqual((await r.json()).detections,[{x:100,y:200,confidence:.8,className:'dart'}]);assert.deepEqual(h.calls.slice(0,3).map(c=>c.path),['/auth/v1/user','/rest/v1/rpc/is_admin','/rest/v1/rpc/autoscoring_roboflow_consume_quota']);assert.equal(h.calls[3].host,'serverless.roboflow.com');assert.equal(h.calls.length,4);});
