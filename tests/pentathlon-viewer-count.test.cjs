const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('Pentathlon shows the common viewer pill, after the live match is ready',()=>{
 const handoff=read('challenge-same-page-handoff-dev.js');
 const branch=handoff.slice(handoff.indexOf('// Pentathlon uses the same X01 match.js'),handoff.indexOf('// Load the existing match modules'));
 a.equal((branch.match(/script\('spectator-presence\.js/g)||[]).length,1);
 a.ok(branch.indexOf("await script('spectator-presence.js")>branch.indexOf('released=true'));
 a.match(branch,/spectator-presence\.js[^']*'\)\.catch/);
 a.doesNotMatch(branch,/match-spectator-broadcast\.js/);
 a.doesNotMatch(read('pentathlon-room-test.css'),/#viewerCount\s*\{[^}]*display\s*:\s*none/);
 a.match(read('match.html'),/id="viewerCountNumber"/);
 a.match(read('match-scene-host.js'),/header.innerHTML=matchHeader/);
 a.match(read('room.html'),/challenge-same-page-handoff-dev\.js\?v=20261125-viewer-count1/);
});
test('Existing Presence counter deduplicates viewers and excludes players',()=>{
 const src=read('spectator-presence.js');
 const snippet=src.slice(src.indexOf('  function spectators(){'),src.indexOf('  function render(){'));
 const states={a:[{role:'player',user_id:'p1'},{role:'player',user_id:'p2'}],b:[{role:'spectator',user_id:'s1',username:'A'},{role:'spectator',user_id:'s1',username:'A'}],c:[{role:'spectator',user_id:'g1',username:'Gjest'}]};
 const result=vm.runInNewContext(snippet+'\nspectators()', {ch:{presenceState:()=>states}});
 a.deepEqual(JSON.parse(JSON.stringify(result)),[{id:'s1',name:'A'},{id:'g1',name:'Gjest'}]);
 a.match(src,/window\.DartArenaMatchEngineState\?\.matchId\?\.\(\)/);
 a.match(src,/match-viewers-\$\{matchId\}/);
});
