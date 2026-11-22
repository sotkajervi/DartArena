const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('Pentathlon Online imports the REAL X01 layout, not a second scoreboard',()=>{
 const js=read('pentathlon-room-test.js'),page=read('room.html'),x01=read('match.html');
 assert.match(js,/fetch\(new URL\('match\.html',location\.href\)/);
 assert.match(js,/querySelector\('#matchView \.match-grid'\)/);
 for(const cls of ['.score-card','.match-info','.match-players','.score-entry'])
   assert.ok(js.includes(cls),'Missing original match component: '+cls);
 const map=js.match(/const map=\{([^}]+)\}/)?.[1];
 assert.ok(map,'Missing original-to-test ID map');
 for(const id of [...map.matchAll(/(match\w+):'pt\w+'/g)].map(m=>m[1]))
   assert.ok(x01.includes('id="'+id+'"'),'Missing ID in original X01 template: '+id);
 assert.ok(page.includes('opponent-focus.css?v='),'Should use X01 TV layout');
 assert.ok(page.includes('match-controls.css?v='),'Should share match controls CSS');
 assert.ok(!page.includes('local-h2h.css?v='),'No redundant local game template in 1v1 room');
 assert.ok(page.includes('pentathlon-room-test.js?v=20261122-x01-template1'),'Cache bust must load new UI');
 assert.doesNotThrow(()=>new Function(js));
});
test('Active match moves only the room video CARDS visually; video tracks/media code untouched',()=>{
 const js=read('pentathlon-room-test.js'),css=read('pentathlon-room-test.css');
 for(const banned of ['getUserMedia(','RTCPeerConnection(','replaceTrack(','addTrack(','DartArenaBootLiveMatch(','match-capture-handoff.js'])
   assert.ok(!js.includes(banned),'Test UI must not touch video: '+banned);
 assert.match(css,/#videoGrid>\.video-card:first-child/);
 assert.match(css,/#videoGrid>\.video-card:nth-child\(2\)/);
 assert.match(css,/#ptPanel\[hidden\]/);
 assert.ok(!js.includes('appendChild(document.getElementById(\'videoGrid\'))'));
 assert.match(js,/from\('pentathlon_room_tests'\)/);
 assert.match(js,/apply_pentathlon_room_test/);
 assert.match(js,/p_expected_version:version/);
});
test('Seven-stage engine and short Enter remain shared and unchanged',()=>{
 const E=require('../pentathlon-2p-engine.js');
 assert.equal(E.STAGES.length,7);
 const s=E.create({name1:'A',name2:'B',starter:0});
 assert.equal(s.current.kind,'x01');
 s.stageIndex=4;s.current.kind='shanghai';s.current.remaining=[0,0];
 assert.equal(E.submitShanghaiTurn(s,[{n:1,m:1}]).current.used[0],3);
 s.stageIndex=5;s.current.kind='clock';s.current.entries=[];s.current.pending=[];
 s.current.turn=0;s.current.used=[0,0];s.current.clockTarget=[1,1];s.current.pent=[0,0];
 const clock=E.submitClockTurn(s,[{n:1,m:2}]);
 assert.equal(clock.current.used[0],3);
 assert.deepEqual(clock.current.entries.map(e=>e.hit),['D1','BOM','BOM']);
});
