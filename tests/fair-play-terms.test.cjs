const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('existing fair play rules preserved and new sections translated',()=>{
 const h=read('fair-play.html'),s=read('dartarena-i18n.js');
 new vm.Script(s);
 for(let n=1;n<=11;n++)a.equal((h.match(new RegExp('id="rule-'+n+'"','g'))||[]).length,1);
 for(const id of [10,11]){
 const m=h.match(new RegExp('id="rule-'+id+'">[^<]*<span>([^<]+)</span></h2><p>([^<]+)</p>'));
 a.ok(m);
 for(const value of m.slice(1))a.ok(s.includes(JSON.stringify(value)+':'));
 }
 a.match(h,/Versjon 1\.1/);a.match(s,/Version 1\.1/);
 a.match(read('index.html'),/href="fair-play.html"/);
});
test('terms draft not wired into registration or published as adopted terms',()=>{
 const d=read('docs/terms-of-use-draft-20261127.md');
 a.match(d,/Arbeidsutkast, ikke vedtatt/);
 a.match(d,/JURIDISK NAVN/);a.match(d,/LEGAL NAME/);
 a.doesNotMatch(read('index.html'),/terms-of-use-draft/);
});