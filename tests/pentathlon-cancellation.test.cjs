const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('pentathlon-room-test.js','utf8');
const handoff=fs.readFileSync('challenge-same-page-handoff-dev.js','utf8');
test('Pentathlon loads the same cancellation dialog before entering the scene',()=>{
 const branch=handoff.slice(handoff.indexOf('// Pentathlon uses the same X01 match.js'),handoff.indexOf('// Load the existing match modules'));
 a.ok(branch.indexOf("await script('cancelled-match-modal.js")>=0);
 a.ok(branch.indexOf("await script('cancelled-match-modal.js")<branch.indexOf('await test.enter('));
 a.match(fs.readFileSync('room.html','utf8'),/challenge-same-page-handoff-dev\.js\?v=20261125-penta-cancel1/);
});
test('Cancellation replaces a review popup and blocks further score actions',()=>{
 const ids=['ptStageOverlay','ptResultsOverlay','ptPointsOverlay','ptInput','ptXSubmit','ptSSubmit','ptAdvance','cancelMatchBtn','ptStatus'];
 const elements=Object.fromEntries(ids.map(id=>[id,{hidden:false,disabled:false}]));
 let shows=0;
 const env={cancelled:false,pending:[1],$:id=>elements[id],window:{DartArenaCancelledMatchModal:{show(){shows++}}}};
 const part=js.slice(js.indexOf('function presentCancellation(){'),js.indexOf('function setup(){'));
 vm.runInNewContext(part+'\npresentCancellation();presentCancellation();',env);
 a.equal(shows,1);a.equal(env.cancelled,true);a.equal(env.pending.length,0);
 for(const id of ids.slice(0,3))a.equal(elements[id].hidden,true);
 for(const id of ids.slice(3,8))a.equal(elements[id].disabled,true);
 a.equal(elements.ptStatus.textContent,'Avbrutt');
 a.match(js,/if\(isCancelled\(\)\)\{presentCancellation\(\);return\}/);
 a.match(js,/if\(!record\|\|saving\|\|isCancelled\(\)\)return/);
 a.match(js,/match_status:matches!pentathlon_room_tests_match_id_fkey\(status\)/);
 a.match(js,/data\?\.match_status\?\.status==='cancelled'/);
 a.match(js,/await broadcast\(\);\s*location.replace\('\.\/'\)/);
});
