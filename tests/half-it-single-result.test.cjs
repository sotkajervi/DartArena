const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('Both online Half-It engines delegate finished matches to the single shared result renderer',()=>{
 for(const p of ['half-it-standard.js','half-it-multileg.js']){
  const s=read(p);a.doesNotMatch(s,/halfResultOverlay|half-result-overlay|ensureResultScreen|syncResultScreen/);
  const line=s.match(/if\(m\.status==='finished'\)window\.DartArenaResults\?\.refresh\(\)\?\.catch\(e=>console\.warn\('Half-It result refresh failed',e\)\)/);
  a.ok(line,p);let calls=0;const c={m:{status:'playing'},window:{DartArenaResults:{refresh(){calls++;return Promise.resolve()}}},console};
  vm.runInNewContext(line[0],c);a.equal(calls,0);c.m.status='finished';vm.runInNewContext(line[0],c);a.equal(calls,1);
 }
 const h=read('half-it.html'),s=read('shared-results.js');
 a.equal((h.match(/src="shared-results\.js\?/g)||[]).length,1);
 a.match(s,/providers\.half_it=providers\.half_it\|\|buildHalfIt/);
 a.match(s,/shownFor===m\.id/);a.match(s,/function mountOverlay\(html\)\{\s*hideResult\(\)/);
});
