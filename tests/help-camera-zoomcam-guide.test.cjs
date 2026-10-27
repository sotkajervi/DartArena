'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const help=fs.readFileSync(path.join(root,'help.html'),'utf8');
const camera=fs.readFileSync(path.join(root,'autozoom','camera-calibration.js'),'utf8');
const match=fs.readFileSync(path.join(root,'match.js'),'utf8');
const zoom=fs.readFileSync(path.join(root,'autozoom','zoom-cam.js'),'utf8');

test('Camera help chapters are linked, unique, and searchable',()=>{
  for(const section of ['camtest','zoomcam','kamera','videofeil']){
    assert.equal((help.match(new RegExp('id="'+section+'"','g'))||[]).length,1,section);
    assert.ok(help.includes('href="#'+section+'"'),section+' missing quick navigation');
  }
  assert.match(help,/const q=document\.getElementById\('helpSearch'\)/);
  assert.match(help,/data-help/);
  assert.match(help,/\.help-steps,\.help-two-col\{grid-template-columns:1fr\}/);
});

test('Calibrating zoom-cam is explained in the order Bull then D20 with automatic saving',()=>{
  const bull=help.indexOf('Klikk først midt i <strong>Bull</strong>');
  const d20=help.indexOf('deretter midt i <strong>D20</strong>');
  assert.ok(bull>0&&d20>bull);
  assert.match(help,/Kalibreringen lagres automatisk/);
  assert.match(help,/Du trenger ikke trykke «Ferdig»/);
  assert.match(camera,/const settings=Z\.calibration\(video,bull,pt,deviceId\(\)\)/);
  assert.match(camera,/Z\.saveConfig\(localStorage,/);
});

test('Live preview, directional control and 2.5% fine adjustment match the implementation',()=>{
  assert.match(help,/Forhåndsvis Zoom-cam/);
  assert.match(help,/Live zoomutsnitt/);
  assert.match(help,/2,5 % av skiveradiusen/);
  assert.match(help,/prøvekast/);
  for(const direction of ['up','down','left','right']){
    assert.match(camera,new RegExp('data-cam-hit-nudge="'+direction+'"'));
  }
  assert.match(camera,/const delta=0\.025/);
  assert.match(camera,/id="camHitOffsetPreview"/);
});

test('Guide distinguishes picture tracking from scoring and explains turn control accurately',()=>{
  assert.match(help,/ikke automatisk poengregistrering/);
  assert.match(help,/Når motstanderen har registrert sin score/);
  assert.match(match,/function syncZoomCamTurn\(previous,next\)/);
  assert.match(match,/zoomCamSession\.pauseTracking\?\.\(\)/);
  assert.match(match,/zoomCamSession\.resetToT20\?\.\(\)/);
  assert.match(zoom,/function pauseTracking\(\)/);
});

test('Guide keeps opaque readable panels, mobile layout, and all previous help topics',()=>{
  assert.match(help,/\.help-shell\{position:relative;z-index:1\}/);
  assert.match(help,/\.help-card\{background:linear-gradient\(145deg,#[0-9a-f]{6},#[0-9a-f]{6}\)/i);
  assert.match(help,/@media\(max-width:720px\)/);
  for(const id of ['komigang','spill','statistikk','turnering','faq']){
    assert.ok(help.includes('id="'+id+'"'),id+' lost');
  }
});
