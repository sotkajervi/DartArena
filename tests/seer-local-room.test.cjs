const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require.resolve('../'+p),'utf8');
test('owner simulation reuses normal layout and shared scoring controller, does not load cloud or history',()=>{
 const h=read('owner-seer-local-501.html'),normal=read('local-head-to-head.html');
 for(const id of ['localScoreForm','localPlayer0','localPlayer1','localUndo','localStatsPanel','localCorrectionModal'])assert.ok(h.includes('id="'+id+'"')&&normal.includes('id="'+id+'"'));
 assert.match(h,/data-seer-simulation="true"/);assert.match(h,/id="seerLocalRoom"[^>]*hidden inert/);
 assert.doesNotMatch(h,/src="[^"]*(practice-cloud|local-h2h-history|local-player-name-history|local-h2h\.js)/);
 assert.doesNotMatch(normal,/seerLocalPanel|data-seer-simulation/);
 assert.match(h,/owner-seer-local-501\.js/);
});
test('shared controller syntax and test-only persistence and scoring hooks',()=>{
 const s=read('local-h2h.js');new vm.Script(s);
 assert.match(s,/function safeSave\(\)\{\s*if\(simulation\)return/);
 assert.match(s,/if\(!simulation\)\{try\{state=E.restore/);
 assert.match(s,/if\(!simulation\|\|!window.DartArenaSeerTurnGuard/);
 assert.match(s,/seerGuard.confirm\(state,proposal,E\)/);
 assert.match(s,/commit\(\(\)=>next/);
 assert.match(s,/function render\(\)\{\s*renderSeer\(\)/);
});
test('owner gate uses server role and loads shared controller only after authorization',()=>{
 const s=read('owner-seer-local-501.js');new vm.Script(s);
 assert.match(s,/db.auth.getUser\(\)/);assert.match(s,/db.rpc\('is_owner'\)/);
 assert.ok(s.indexOf('role.data!==true')<s.indexOf("script.src='./local-h2h.js"));
 assert.match(s,/event==='SIGNED_OUT'/);assert.match(s,/room.inert=true/);
});
