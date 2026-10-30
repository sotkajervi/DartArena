'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const previewHost='dartarena-sfu-preview.sotkajervi.workers.dev';
const securityWorker='https://dartarena-realtime-security-test.sotkajervi.workers.dev';

function configOn(hostname,search=''){
 const window={};
 const context={window,location:{hostname,search},navigator:{mediaDevices:null},URLSearchParams};
 vm.runInNewContext(read('sfu-config.js'),context);
 return window.DARTARENA_SFU.workerUrl;
}
function routedScript(file,hostname,search='',stopped=false){
 const scripts=[];
 const window={DARTARENA_POSTMATCH_MEDIA_STOPPED:stopped,addEventListener(){},dispatchEvent(){}};
 const document={head:{appendChild(node){scripts.push(node.src)}},createElement(){return{}},getElementById(){return null}};
 const context={window,document,location:{hostname,search},URLSearchParams,console:{debug(){}},setInterval(){return 1},clearInterval(){},CustomEvent:class {}};
 vm.runInNewContext(read(file),context);
 return {scripts,mode:window.DARTARENA_ACTIVE_MEDIA_MODE||null};
}
test('only isolated preview hostname can select security test Worker',()=>{
 assert.equal(configOn(previewHost),securityWorker);
 assert.equal(configOn('sotkajervi.github.io','?sfuSecurityTest=1'),'https://dartarena-realtime.sotkajervi.workers.dev');
 assert.equal(configOn('localhost','?sfuSecurityTest=1'),'https://dartarena-realtime.sotkajervi.workers.dev');
});
test('waiting room routes directly to isolated SFU, with no peer-first delay',()=>{
 const result=routedScript('room-media-router.js',previewHost);
 assert.equal(result.mode,'sfu');
 assert.deepEqual(result.scripts,['room-sfu-media.js?v=20261030-sfu2']);
});
test('X01 match routes to isolated SFU but not after media shutdown',()=>{
 assert.deepEqual(routedScript('match-media-router.js',previewHost).scripts,['match-sfu-media.js?v=20261030-sfu2']);
 assert.deepEqual(routedScript('match-media-router.js',previewHost,'',true).scripts,[]);
});
test('URL flags on regular DartArena cannot opt into isolated SFU',()=>{
 for(const filename of ['room-media-router.js','match-media-router.js']){
  const result=routedScript(filename,'sotkajervi.github.io','?sfuSecurityTest=1');
  assert.equal(result.mode,'peer');
  assert.deepEqual(result.scripts,[]);
 }
});
test('each page loads preview config/client before media router',()=>{
 for(const [page,router] of [['room.html','room-media-router.js'],['match.html','match-media-router.js']]){
  const source=read(page);
  const config=source.indexOf('sfu-config.js?v=20261030-sfu2');
  const client=source.indexOf('sfu-client.js?v=20261030-sfu2');
  const mediaRouter=source.indexOf(router+'?v=20261030-sfu2');
  assert.ok(config>=0&&client>config&&mediaRouter>client);
 }
});
test('preview uses same-origin navigation for the handoff between waiting room and match',()=>{
 assert.match(read('room.js'),/location.href=`\$\{pageForVariant\(payload.gameVariant\)\}\?id=/);
 assert.match(read('room-secure-create.js'),/location.href=`\$\{page\}\?id=/);
});
test('Zoom-cam and camera changes use the selected local media stream',()=>{
 const s=read('match-sfu-media.js');
 assert.match(s,/await client\.publish\(safeStream\(\)\)/);
 assert.match(s,/const signature=trackSignature\(\)/);
 assert.match(s,/signature!==publishedSignature\)await publish\(true\)/);
 assert.match(s,/if\(stopped\|\|window\.DARTARENA_POSTMATCH_MEDIA_STOPPED\)/);
});
test('secure SFU client always sends user and room context to isolated Worker',()=>{
 const source=read('sfu-client.js');
 assert.match(source,/Authorization.*Bearer/);
 assert.match(source,/X-DartArena-Room-Kind/);
 assert.match(source,/X-DartArena-Room-Id/);
 assert.doesNotMatch(source,/service_role|REALTIME_SFU_BEARER_TOKEN/);
});
test('finished match cleanup stops SFU, protects ongoing postgame chat',()=>{
 assert.match(read('match-sfu-media.js'),/window\.DartArenaMatchMedia=\{mode:'sfu',stop:stopMedia/);
 assert.match(read('match-media-router.js'),/window\.DARTARENA_POSTMATCH_MEDIA_STOPPED/);
 assert.match(read('post-match-media-lifecycle.js'),/GRACE_MS=15000/);
 assert.match(read('post-match-media-lifecycle.js'),/postmatch-left/);
 assert.match(read('match.html'),/post-match-media-lifecycle\.js/);
});
test('deployment config is restricted to isolated Worker names',()=>{
 assert.match(read('cloudflare/wrangler.media-test.jsonc'),/"name": "dartarena-realtime-security-test"/);
 assert.match(read('cloudflare/wrangler.frontend-preview.jsonc'),/"name": "dartarena-sfu-preview"/);
});
