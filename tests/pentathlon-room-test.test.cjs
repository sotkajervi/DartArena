const test=require('node:test');
const a=require('node:assert/strict'),fs=require('node:fs'),p=require('node:path');
const read=f=>fs.readFileSync(p.join(__dirname,'..',f),'utf8');
test('Pentathlon chosen in waiting room; server receives configured starter and variant',()=>{
 const room=read('room.html'),js=read('room.js'),proposal=read('room-secure-create.js'),router=read('game-router.js');
 a.match(room,/value="pentathlon" hidden/);a.match(room,/id="roomStarter"/);
 a.match(router,/pentathlon:\{variant:'pentathlon'/);
 a.match(proposal,/p_game_variant:variant/);
 a.ok(proposal.includes("starterChoice==='me'?profile.id:starterChoice==='opponent'?other:null"));
 a.ok(proposal.includes("raw==='pentathlon'||!!document.getElementById('roomWarmup')"));
 a.ok(js.includes("variant==='pentathlon'?"));
});
test('Existing coinflip, acceptance and match scene, no waiting-room scoring button',()=>{
 const js=read('pentathlon-room-test.js'),s=read('challenge-x01-transition.js');
 a.ok(read('room-secure-create.js').includes("accept_challenge_match_proposal"));
 a.ok(read('room-coin-flip-sync.js').includes("DartArenaCoinFlip?.play"));
 a.ok(s.includes("await test.enter({matchId,challengeId:"));
 a.ok(js.includes("window.DartArenaPentathlonMatchTest=Object.freeze({enter})"));
 a.ok(js.includes("await host.prepare()"));a.ok(js.includes("await host.enter()"));
 a.ok(read('match-scene-host.js').includes("stage.querySelector('#daMatchVideoSlot').replaceWith(video)"));
 a.ok(js.includes("scene.appendChild(dock)"));a.ok(js.includes("const dock=node('div','focus-input-dock')"));
 a.ok(!js.includes('onclick=startGame'));a.ok(!js.includes('Math.random()'));
 a.ok(!js.includes('getUserMedia('));a.ok(!js.includes('RTCPeerConnection('));
});
test('X01 scoreboard inherited, no custom video grid or sidebar result scroll',()=>{
 const js=read('pentathlon-room-test.js'),css=read('pentathlon-room-test.css');
 a.ok(js.includes("const darts=node('div','live-darts')"));
 a.ok(js.includes("const avg=node('div','live-avg')"));
 a.ok(js.includes("sets.classList.add('hidden')"));
 a.ok(js.includes('ptResultDetails'));a.ok(css.includes('.pt-details'));
 a.doesNotMatch(css,/#ptPanel \.match-score\{|#ptPanel \.match-player\{|#videoGrid\s*\{|#matchView\s*\{/);
 a.ok(js.includes("classList.toggle('own-turn-focus',live&&mine())"));
});
test('Server match starter and identity are used; F5 resumes by match ID',()=>{
 const js=read('pentathlon-room-test.js'),room=read('room.js');
 a.ok(js.includes("m.match_starter_id===m.player1_id?0:1"));
 a.ok(js.includes("start_pentathlon_match_test"));
 a.ok(js.includes("apply_pentathlon_room_test"));
 a.ok(js.includes("eq('match_id',activeMatchId)"));
 a.ok(js.includes("p_expected_version:version"));
 a.ok(room.includes("if(active.game_variant==='pentathlon')return {pentathlonMatchId:active.id}"));
 a.ok(room.includes("window.DartArenaPentathlonResumeMatchId=resumed.pentathlonMatchId"));
 a.ok(!js.includes('DartArenaBootLiveMatch('));
});
test('Existing seven-stage engine including Enter-to-miss works unchanged',()=>{
 const E=require('../pentathlon-2p-engine.js');a.equal(E.STAGES.length,7);
 const game=E.create({name1:'A',name2:'B',starter:0});
 a.equal(E.submitX01(game,{score:60}).current.remaining[0],441);
 game.stageIndex=4;game.current.kind='shanghai';game.current.remaining=[0,0];
 a.equal(E.submitShanghaiTurn(game,[{n:1,m:1}]).current.used[0],3);
 game.stageIndex=5;game.current.kind='clock';game.current.entries=[];game.current.pending=[];
 game.current.turn=0;game.current.used=[0,0];game.current.clockTarget=[1,1];game.current.pent=[0,0];
 a.deepEqual(E.submitClockTurn(game,[{n:1,m:2}]).current.entries.map(e=>e.hit),['D1','BOM','BOM']);
});