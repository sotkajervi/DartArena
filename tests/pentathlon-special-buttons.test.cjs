const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('pentathlon-room-test.js','utf8');
const part=src.slice(src.indexOf('function choice('),src.indexOf('function stLabel('));
function el(tag,cls='',value=''){
 return {tag,cls,textContent:value,children:[],dataset:{},disabled:false,classList:{add(x){this.added=x}},append(...c){this.children.push(...c)},replaceChildren(...c){this.children=c}};
}
function scene(kind,target,pending=[]){
 const host=el('div'),state={kind,turn:0,clockTarget:[target.number,1],used:[0,0],pending:[]};
 let renders=0;const env={node:el,stage:()=>state,game:()=>({current:state}),E:{currentTarget:()=>target},$:()=>host,saving:false,mine:()=>true,pending,render:()=>renders++};
 vm.createContext(env);vm.runInContext(part+'\nactions()',env);
 return {host,pending,buttons:host.children,layout:host.dataset.layout,renders:()=>renders};
}
const labels=s=>s.buttons.map(b=>b.children.map(c=>c.textContent).join('/'));
test('Shanghai and open Half-It use identical four buttons and shortcuts',()=>{
 for(const kind of ['shanghai','half']){
  const s=scene(kind,{number:16,mult:0});
  a.equal(s.layout,'four');a.deepEqual(labels(s),['SINGLE/1','DOBBEL/2','TRIPPEL/3','BOM/0']);
  s.buttons[2].onclick();a.equal(s.pending[0].n,16);a.equal(s.pending[0].m,3);a.equal(s.renders(),1);
 }
});
test('Half-It D7, T10 and Bull use Treff and Bom, preserving actual field and key',()=>{
 for(const [n,m] of [[7,2],[10,3],[25,2]]){
  const s=scene('half',{number:n,mult:m});
  a.equal(s.layout,'two');a.deepEqual(labels(s),['TREFF/'+m,'BOM/0']);
  s.buttons[0].onclick();a.equal(s.pending[0].n,n);a.equal(s.pending[0].m,m);
  s.buttons[1].onclick();a.equal(s.pending[1].n,0);a.equal(s.pending[1].m,0);
 }
});
test('Clock preserves next double preview and Enter confirmation',()=>{
 const s=scene('clock',{number:7},[{n:7,m:2}]);
 a.equal(s.layout,'two');a.deepEqual(labels(s),['TREFF D8/2','BOM/0']);
 s.buttons[0].onclick();a.equal(s.pending[1].n,8);a.equal(s.pending[1].m,2);
 a.match(src,/pending.push\(dart\);render\(\)/);
 a.match(src,/e.key==='Enter'/);
});
test('All exercises share existing two-line colors and equal-width layout',()=>{
 const css=fs.readFileSync('pentathlon-room-test.css','utf8');
 a.match(css,/\.pt-special-hit-name\{\s*display:block;color:#00eaf4/);
 a.match(css,/\.pt-special-hit-key\{\s*display:block;color:#fff/);
 a.match(css,/\[data-layout="two"\]\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 a.match(css,/\[data-layout="four"\]\{\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 const html=fs.readFileSync('room.html','utf8');
 a.match(html,/pentathlon-room-test\.js\?v=20261125-special-buttons1/);
 a.match(html,/pentathlon-room-test\.css\?v=20261125-special-buttons1/);
});
