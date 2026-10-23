/* node --test tests/d1-live-testzone.test.cjs */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('deepdarts-live.html'),js=read('autoscoring/d1-live.js');
test('isolated D1 live test scripts are syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(js));
  assert.doesNotThrow(()=>new Function(read('autoscoring/lobby-link.js')));
});
test('all D1 live controls exist in the page',()=>{
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const referenced=[...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
  assert.ok(referenced.length>=30);
  for(const id of referenced)assert.ok(ids.has(id),'Missing element '+id);
  for(const script of ['autoscoring/geometry.js','autozoom/auto-calibration.js',
    'autoscoring/deepdarts-tflite.js','autoscoring/d1-live.js'])assert.ok(html.includes(script));
});
test('owner/admin gate and isolated local-only scoring',()=>{
  assert.match(js,/db\.auth\.getUser\(/);
  assert.match(js,/db\.rpc\('is_owner'\)/);
  assert.match(js,/db\.rpc\('is_admin'\)/);
  assert.match(js,/getUserMedia/);
  assert.match(js,/D\.infer/);
  assert.doesNotMatch(js,/db\.from\(|\.insert\(|\.upsert\(|\.update\(/);
  assert.match(js,/visibilitychange/);
  assert.match(js,/pagehide/);
});
test('only authorized users see the dedicated lobby link',()=>{
  const lobby=read('index.html'),gate=read('autoscoring/lobby-link.js');
  assert.match(lobby,/id="d1LiveZoneLink"[^>]*hidden/);
  assert.match(gate,/d1LiveZoneLink/);
  assert.match(gate,/is_owner/);
  assert.match(gate,/is_admin/);
});
