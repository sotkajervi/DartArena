const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {shouldClose}=require('../post-match-media-lifecycle.js');
const root=path.join(__dirname,'..');

test('only a synced finished room with no opponent can close',()=>{
  assert.equal(shouldClose('finished',true,false),true);
  assert.equal(shouldClose('finished',true,true),false);
  assert.equal(shouldClose('finished',false,false),false);
});
test('active, pending and cancelled matches keep their media',()=>{
  for(const status of ['playing','pending','cancelled','live','']){
    assert.equal(shouldClose(status,true,false),false);
  }
});
test('every online game includes post-match cleanup',()=>{
  for(const page of ['match.html','cricket.html','half-it.html','61-match.html','jdc-match.html']){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/post-match-media-lifecycle\.js\?v=20261029-postmatch1/);
  }
});
test('cleanup has disconnect grace and explicit leave signal',()=>{
  const code=fs.readFileSync(path.join(root,'post-match-media-lifecycle.js'),'utf8');
  assert.match(code,/GRACE_MS=15000/);
  assert.match(code,/postmatch-left/);
  assert.match(code,/camera\.disabled=true/);
  assert.match(code,/resultat og statistikk/i);
});
test('media and telemetry services expose stop methods',()=>{
  assert.match(fs.readFileSync(path.join(root,'match-sfu-media.js'),'utf8'),/window\.DartArenaMatchMedia=\{mode:'sfu',stop:/);
  assert.match(fs.readFileSync(path.join(root,'match-media-telemetry.js'),'utf8'),/DartArenaMediaTelemetry=\{flush,stop,/);
});
