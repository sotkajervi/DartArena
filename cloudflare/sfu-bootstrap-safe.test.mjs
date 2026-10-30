import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const src=await readFile(new URL('./sfu-bootstrap-safe.js',import.meta.url),'utf8');
const code=src.replace("import { DurableObject } from 'cloudflare:workers';","class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }")
.replace('export class SfuRoom','class SfuRoom').replace('export default {','const worker = {')+'\n globalThis.__out={SfuRoom,worker};';
const sandbox={Request,Response,URL,JSON};
vm.runInNewContext(code,sandbox);
const {SfuRoom,worker}=sandbox.__out;
test('bootstrap health identifies disabled media',async()=>{
 const res=await worker.fetch(new Request('https://test.example/health'));
 assert.equal(res.status,200);assert.equal((await res.json()).mediaEnabled,false);
});
test('all SFU endpoints fail closed',async()=>{
 for(const path of ['/api/sfu/session','/api/sfu/publish','/api/sfu/subscribe','/api/sfu/renegotiate']){
  const r=await worker.fetch(new Request('https://test.example'+path,{method:'POST'}));
  assert.equal(r.status,503);
 }
});
test('Durable Object itself rejects every request',async()=>{
 const instance=new SfuRoom({},{});
 assert.equal((await instance.fetch()).status,503);
});
const config=JSON.parse((await readFile(new URL('./wrangler.bootstrap.jsonc',import.meta.url),'utf8')).replace(/^\s*\/\/.*$/gm,''));
test('bootstrap config cannot target production',()=>{
 assert.equal(config.name,'dartarena-realtime-security-test');
 assert.equal(config.main,'sfu-bootstrap-safe.js');
 assert.equal(config.durable_objects.bindings[0].name,'SFU_ROOMS');
 assert.deepEqual(config.migrations[0].new_sqlite_classes,['SfuRoom']);
});

test('bootstrap never exposes secrets, even when environment contains them',async()=>{
 const env={REALTIME_SFU_BEARER_TOKEN:'sentinel-secret',SUPABASE_URL:'sentinel-url'};
 for(const path of ['/health','/api/sfu/session','/api/sfu/publish']){
  const response=await worker.fetch(new Request('https://test.example'+path,{method:path==='/health'?'GET':'POST'}),env);
  const text=await response.text();
  assert.equal(text.includes('sentinel-secret'),false);
  assert.equal(text.includes('sentinel-url'),false);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
test('bootstrap rejects requests with arbitrary methods and paths',async()=>{
 for(const [method,path] of [['GET','/api/sfu/session'],['PUT','/api/sfu/renegotiate'],['DELETE','/health'],['GET','/unknown']]){
  const response=await worker.fetch(new Request('https://test.example'+path,{method}));
  assert.equal(response.status,503);
 }
});
test('bootstrap preserves Dashboard-managed variables',()=>{
 assert.equal(config.keep_vars,true);
 assert.equal(config.name,'dartarena-realtime-security-test');
});
