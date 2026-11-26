const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../pentathlon-2p-engine.js');
const src=fs.readFileSync('pentathlon-2p.js','utf8');
const start=src.indexOf('const HALF_TARGETS='),end=src.indexOf('let halfQueue=[];',start);
assert.ok(start>=0&&end>start);
const {HALF_TARGETS,halfHitKey,halfDartForKey}=vm.runInNewContext(src.slice(start,end)+';({HALF_TARGETS,halfHitKey,halfDartForKey})');
const plain=x=>JSON.parse(JSON.stringify(x));
test('D7, T10 and Bull all use key 2, preserve multiplier and reject 1/3',()=>{
 for(const [i,n,m] of [[2,7,2],[4,10,3],[6,25,2]]){
  const rule=HALF_TARGETS[i];
  assert.equal(halfHitKey(rule,m),'2');
  assert.deepEqual(plain(halfDartForKey(rule,'2')),{n,m});
  assert.deepEqual(plain(halfDartForKey(rule,'0')),{n:0,m:0});
  for(const key of ['1','3'])assert.equal(halfDartForKey(rule,key),null);
 }
});
test('open targets preserve all three multipliers',()=>{
 for(const i of [0,1,3,5])for(const m of [1,2,3]){
  const rule=HALF_TARGETS[i];assert.equal(halfHitKey(rule,m),String(m));
  assert.deepEqual(plain(halfDartForKey(rule,String(m))),{n:rule.n,m});
 }
});
test('T10 hit scores 30 and earns three pentathlon points',()=>{
 let s=E.create({name1:'A',name2:'B',starter:0});s.stageIndex=6;s.current.kind='half';s.current.start=null;s.current.remaining=[0,0];s.current.used=[12,12];
 const rule=HALF_TARGETS[4];const before=s.current.halfScores[0];
 s=E.submitDart(s,plain(halfDartForKey(rule,'2')));
 assert.equal(s.current.entries.at(-1).hit,'T10');
 assert.equal(s.current.entries.at(-1).scoreValue,30);
 assert.equal(s.current.pent[0],3);
});
test('display and keyboard use shared mapping, local and AI use same versioned file',()=>{
 assert.match(src,/halfHitKey\(target,m\)/);assert.match(src,/halfDartForKey\(rule,event\.key\)/);
 assert.match(fs.readFileSync('pentathlon-2p.html','utf8'),/pentathlon-2p\.js\?v=20261126-half-fixed-key1/);
});
