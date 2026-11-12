const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {shouldClose,timeRemaining,POSTMATCH_MAX_MS}=require('../post-match-media-lifecycle.js');
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
test('60-minute cap only applies to finished matches and uses the original finish time',()=>{
  const finishedAt=Date.parse('2026-11-11T23:00:00Z');
  assert.equal(POSTMATCH_MAX_MS,60*60*1000);
  assert.equal(timeRemaining('playing',finishedAt,finishedAt+POSTMATCH_MAX_MS),null);
  assert.equal(timeRemaining('finished',null,finishedAt),null);
  assert.equal(timeRemaining('finished',finishedAt,finishedAt),POSTMATCH_MAX_MS);
  assert.equal(timeRemaining('finished',finishedAt,finishedAt+POSTMATCH_MAX_MS-1),1);
  assert.equal(timeRemaining('finished',finishedAt,finishedAt+POSTMATCH_MAX_MS),0);
  assert.equal(timeRemaining('finished',finishedAt,finishedAt+POSTMATCH_MAX_MS+2000),0);
});
test('every online game includes post-match cleanup',()=>{
  for(const page of ['match.html','cricket.html','half-it.html','61-match.html','jdc-match.html']){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/post-match-media-lifecycle\.js\?v=20261112-postmatch60m1/);
  }
});
test('cleanup has disconnect grace and explicit leave signal',()=>{
  const code=fs.readFileSync(path.join(root,'post-match-media-lifecycle.js'),'utf8');
  assert.match(code,/GRACE_MS=15000/);
  assert.match(code,/postmatch-left/);
  assert.match(code,/camera\.disabled=true/);
  assert.match(code,/resultat og statistikk/i);
});
test('the timer is wired to the authoritative finished_at value and cleanup',()=>{
  const code=fs.readFileSync(path.join(root,'post-match-media-lifecycle.js'),'utf8');
  assert.match(code,/select\('id,player1_id,player2_id,status,finished_at'\)/);
  assert.match(code,/setStatus\(row\?\.status,row\?\.finished_at\)/);
  assert.match(code,/stopMedia\('postmatch-timeout'\)/);
  assert.match(code,/clearTimeout\(deadlineTimer\)/);
  const handoff=fs.readFileSync(path.join(root,'tournament-same-page-handoff-dev.js'),'utf8');
  assert.match(handoff,/post-match-media-lifecycle\.js\?v=20261112-postmatch60m1/);
});
test('media and telemetry services expose stop methods',()=>{
  assert.match(fs.readFileSync(path.join(root,'match-sfu-media.js'),'utf8'),/window\.DartArenaMatchMedia=\{mode:'sfu',stop:/);
  assert.match(fs.readFileSync(path.join(root,'match-media-telemetry.js'),'utf8'),/DartArenaMediaTelemetry=\{flush,stop,/);
});
