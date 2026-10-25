'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'owner-board-calibration-lab.html'),'utf8');
const js=fs.readFileSync(path.join(root,'owner-board-calibration-lab.js'),'utf8');
test('Lab does not inherit transparent DartArena lobby backdrop',()=>{
  assert.doesNotMatch(html,/href=["']\.\/style\.css/);
  assert.match(html,/body::before,body::after\{display:none!important/);
  assert.match(html,/background:var\(--panel\)!important/);
  assert.match(html,/backdrop-filter:none!important/);
});
test('Model and camera status visible before the model picker',()=>{
  assert.ok(html.indexOf('id="status"')<html.indexOf('id="modelFile"'));
  for(const id of ['runState','status','runtimeState','copyDiagnostic','cameraState','imageState','visual','analyze']){
    assert.equal(html.split('id="'+id+'"').length,2,id+' is a unique UI element');
  }
  assert.match(js,/function runtimeStatus\(\)/);
  assert.match(js,/TFLite.*mangler/);
  assert.match(js,/45 sekunder/);
});
test('Image preview is hidden until a real local image is selected',()=>{
  assert.match(html,/<canvas id="visual"[^>]+ hidden/);
  assert.match(js,/view\.hidden=false/);
  assert.match(js,/source=await imageFromFile/);
});
test('Owner gate and no modification to real calibration, media sends or scoring',()=>{
  assert.match(html,/<div id="app" hidden>/);
  assert.match(js,/db\.rpc\('is_owner'\)/);
  assert.doesNotMatch(js,/\.saveConfig\(|localStorage\.setItem\(|\.storage\.from\(|\.insert\(|\.upsert\(/);
  assert.match(js,/window\.addEventListener\('pagehide',stopCamera\)/);
});
test('Current page has versioned script and JS parses',()=>{
  assert.match(html,/owner-board-calibration-lab\.js\?v=20261025-wireaudit1/);
  assert.doesNotThrow(()=>new Function(js));
});

test('TFLite WebAssembly path must be set before model load',()=>{
  assert.match(js,/const TFLITE_WASM_DIR='https:\/\/cdn\.jsdelivr\.net\/npm\/@tensorflow\/tfjs-tflite@0\.0\.1-alpha\.10\/dist\//);
  assert.match(js,/tflite\.setWasmPath\(TFLITE_WASM_DIR\)/);
  assert.ok(js.indexOf('ensureWasmPath();')<js.indexOf('tflite.loadTFLiteModel(bytes'));
  assert.match(js,/WebAssembly-motoren startet ikke/);
  assert.match(js,/TFLite JS: lastet · WASM: ikke startet/);
});
