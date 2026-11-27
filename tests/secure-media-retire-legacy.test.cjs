const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('all root production JS and HTML avoid constructing the unauthenticated SFU client',()=>{
 const hits=[];
 for(const p of fs.readdirSync('.').filter(p=>/\.(?:js|html)$/.test(p))){
   const s=read(p);
   if(/new\s+(?:window\.)?DartArenaSFU\s*\(|\?\s*window\.DartArenaSecureSFU\s*:\s*window\.DartArenaSFU/.test(s))hits.push(p);
 }
 a.deepEqual(hits,[]);
});
test('fallback and viewer constructors carry explicit room and authenticated client',()=>{
 const checks=[
 ['room-sfu-media.js',"{kind:'challenge',id:challengeId},db"],
 ['match-sfu-media.js',"{kind:'match',id:safeMatchId()},safeDb()"],
 ['match-spectator-broadcast.js',"{kind:'match',id:liveMatchId},client"],
 ['spectate-runtime.js',"{kind:'match',id:matchId},db"],
 ['spectate.js',"{kind:'match',id:matchId},db"],
 ['tournament-match-viewer.js',"{kind:'match',id:tm.live_match_id},db"]
 ];
 for(const [p,context] of checks){
   const s=read(p);a.ok(s.includes('new window.DartArenaSecureSFU(window.DARTARENA_SFU.secureWorkerUrl,'+context+')'),p);
 }
 for(const p of ['tournament-match-room.js','tournament-room-preferred-media.js']){
   const s=read(p);a.match(s,/const SfuClient=window\.DartArenaSecureSFU;/);a.match(s,/new SfuClient\(window\.DARTARENA_SFU\.secureWorkerUrl,\s*\{kind:'tournament_match'/);
 }
});
test('Cricket loads authenticated dependency before spectator publishing',()=>{
 const s=read('cricket.html');const i=s.indexOf('sfu-client-secure.js?');a.ok(i>=0);a.ok(s.indexOf('match-spectator-broadcast.js?v=20261127-secureonly1')>i);a.doesNotMatch(s,/src="sfu-client\.js\?/);
});
test('cache versions updated for direct entry pages and seamless handoff loaders',()=>{
 for(const [p,files] of Object.entries({
 'match.html':['match-media-router','match-spectator-broadcast'],
 'room.html':['room-media-router','challenge-same-page-handoff-dev'],
 'spectate.html':['spectate-runtime'],
 'tournament-match-room.html':['tournament-match-room','tournament-room-preferred-media','tournament-same-page-handoff-dev'],
 'tournament-match-viewer.html':['tournament-match-viewer'],
 'challenge-same-page-handoff-dev.js':['match-media-router','match-spectator-broadcast'],
 'tournament-same-page-handoff-dev.js':['match-media-router','match-spectator-broadcast'],
 'match-media-router.js':['match-sfu-media'],
 'room-media-router.js':['room-sfu-media']
 }))for(const name of files)a.ok(read(p).includes(name+'.js?v=20261127-secureonly1'),p+' '+name);
});
