const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('all migrated constructors use authenticated match context and never the legacy worker',()=>{
 for(const p of ['one-to-one-media.js','jdc-match-media.js','sixty-one-match.js','half-it.js','half-it-standard.js']){
  const s=read(p);a.doesNotMatch(s,/new (?:window\.)?DartArenaSFU\(/,p);
  const constructors=[...s.matchAll(/new window\.DartArenaSecureSFU\([^;]+\)/g)];
  a.ok(constructors.length,p);
  for(const [code] of constructors){
   a.equal(code,"new window.DartArenaSecureSFU(window.DARTARENA_SFU.secureWorkerUrl,{kind:'match',id:matchId},db)");
   const expectedDb={auth:{}},calls=[];
   const client=vm.runInNewContext(code,{window:{DARTARENA_SFU:{secureWorkerUrl:'https://secure.invalid'},DartArenaSecureSFU:class{constructor(...args){calls.push(args)}}},matchId:'test-match',db:expectedDb});
   a.equal(calls[0][0],'https://secure.invalid');a.equal(calls[0][1].kind,'match');a.equal(calls[0][1].id,'test-match');a.equal(calls[0][2],expectedDb);
  }
 }
});
test('secure dependency precedes media engines on every migrated page',()=>{
 for(const p of ['61-match.html','jdc-match.html']){
  const s=read(p),i=s.indexOf('sfu-client-secure.js?v=20261127-securefallback1');
  a.ok(i>=0,p);a.ok(s.indexOf('one-to-one-media.js?v=20261127-securefallback1')>i,p);a.doesNotMatch(s,/src="sfu-client\.js\?/);
  if(p==='61-match.html')a.ok(s.indexOf('sixty-one-match.js?v=20261127-securefallback1')>i);
 }
 const b=read('half-it-bootstrap.js');
 a.equal((b.match(/sfu-client-secure\.js\?v=20261127-securefallback1/g)||[]).length,2);
 a.doesNotMatch(b,/sfu-client\.js\?/);a.match(read('half-it.html'),/half-it-bootstrap\.js\?v=20261127-securefallback1/);
 a.doesNotMatch(read('sfu-test.html'),/new DartArenaSFU|getUserMedia|sfu-client\.js/);
});
test('authenticated fallback request transmits user token and exact room, never retries on denial',async()=>{
 const calls=[];const root={};vm.runInNewContext(read('sfu-client-secure.js'),{window:root,fetch:async(url,opts)=>{calls.push({url,opts});return {ok:false,status:403,json:async()=>({error:'denied'})}}});
 const c=new root.DartArenaSecureSFU('https://secure.invalid',{kind:'match',id:'fixture-id'},{auth:{getSession:async()=>({data:{session:{access_token:'fixture-token'}}}),refreshSession:async()=>{throw Error('unexpected refresh')}}});
 await a.rejects(c.request('/api/sfu/session',undefined,'POST','subscribe'),/403/);a.equal(calls.length,1);a.equal(calls[0].opts.headers.Authorization,'Bearer fixture-token');a.equal(calls[0].opts.headers['X-DartArena-Room-Id'],'fixture-id');a.equal(calls[0].opts.headers['X-DartArena-SFU-Intent'],'subscribe');
});
