// Contract test for the staging browser SFU client. No network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../sfu-client.js',import.meta.url),'utf8');
function setup(accessToken){
 const requests=[];
 const sandbox={window:{},fetch:async(url,init)=>{
  requests.push({url,init});
  return new Response(JSON.stringify({ok:true,sfu:{sessionId:'session_123456789'}}),{status:200});
 },Response,RTCPeerConnection:class{}};
 if(accessToken!==undefined)sandbox.window.db={auth:{getSession:async()=>({data:{session:accessToken?{access_token:accessToken}:null},error:null})}};
 vm.runInNewContext(source,sandbox);
 return {client:new sandbox.window.DartArenaSFU('https://worker.test/',{kind:'match',id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}),requests};
}
test('client blocks missing auth client before calling Worker',async()=>{
 const {client,requests}=setup(undefined);
 await assert.rejects(client.request('/api/sfu/session'),/auth client unavailable/);
 assert.equal(requests.length,0);
});
test('client blocks signed-out users before calling Worker',async()=>{
 const {client,requests}=setup(null);
 await assert.rejects(client.request('/api/sfu/session'),/Sign in required/);
 assert.equal(requests.length,0);
});
test('client attaches bearer token and exact room context',async()=>{
 const {client,requests}=setup('test-jwt-not-secret');
 await client.request('/api/sfu/session');
 assert.equal(requests.length,1);
 assert.equal(requests[0].init.headers.Authorization,'Bearer test-jwt-not-secret');
 assert.equal(requests[0].init.headers['X-DartArena-Room-Kind'],'match');
 assert.equal(requests[0].init.headers['X-DartArena-Room-Id'],'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 assert.equal(requests[0].url,'https://worker.test/api/sfu/session');
});
test('client preserves PUT for renegotiation and JSON bodies',async()=>{
 const {client,requests}=setup('test-jwt');
 await client.request('/api/sfu/renegotiate',{sessionId:'session_123456789'},'PUT');
 assert.equal(requests[0].init.method,'PUT');
 assert.equal(JSON.parse(requests[0].init.body).sessionId,'session_123456789');
});
