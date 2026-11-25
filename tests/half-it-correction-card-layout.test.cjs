const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Correction cards show the round, total and only a halving badge if needed',()=>{
 const chips={children:[],replaceChildren(){this.children=[]},append(el){this.children.push(el)}};
 const src=fs.readFileSync('half-it-round-correction.js','utf8');
 const start=src.indexOf(' function draw(){'),end=src.indexOf(' function field(',start);
 a.ok(start>=0&&end>start);
 const panel={},opened=[],rows=[{round_no:1,score_after:26,success:true,round_points:26},{round_no:2,score_after:13,success:false},{round_no:3,score_after:7,success:false}];
 const make=()=>({children:[],attrs:{},append(...els){this.children.push(...els)},setAttribute(k,v){this.attrs[k]=v}});
 const c={chips,panel,eligible:()=>rows,document:{createElement:make},open:v=>opened.push(v)};
 vm.runInNewContext(src.slice(start,end)+'\ndraw();',c);
 a.equal(chips.children.length,3);
 a.deepEqual(chips.children.map(b=>b.children.map(x=>x.textContent)),[['Runde 1','26'],['Runde 2','13','½'],['Runde 3','7','½']]);
 a.equal(chips.children[1].children[2].title,'Halvert');
 a.equal(chips.children[1].attrs['aria-label'],'Korriger runde 2, score 13, halvert');
 chips.children[1].onclick();a.equal(opened[0],rows[1]);
 rows.length=0;vm.runInNewContext(src.slice(start,end)+'\ndraw();',c);a.equal(panel.hidden,true);
});
