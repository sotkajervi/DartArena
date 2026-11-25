const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('Half-It current starter does not alternate twice or follow current turn',()=>{
 const nodes={};
 for(const id of ['halfName1','halfName2']){
   const host={children:[],querySelector(){return this.children[0]},appendChild(el){this.children.push(el);el.remove=()=>this.children=[]}};
   nodes[id]=host;
 }
 const document={getElementById:id=>nodes[id]||null};
 const window={DartArenaLegStarterMarkerUI:{create:()=>({className:'da-leg-starter-dart'})}};
 vm.runInNewContext(read('half-it-online-layout.js'),{window,document});
 const base={player1_id:'a',player2_id:'b',status:'playing',current_leg:1,match_starter_id:'a',turn_player_id:'b'};
 const render=window.DartArenaHalfItStarter.render;
 const counts=()=>[nodes.halfName1.children.length,nodes.halfName2.children.length];
 render(base);a.deepEqual(counts(),[1,0]);
 render({...base,turn_player_id:'a'});a.deepEqual(counts(),[1,0]);
 render({...base,current_leg:2,match_starter_id:'b',turn_player_id:'a'});a.deepEqual(counts(),[0,1]);
 render({...base,current_leg:3,match_starter_id:'a'});a.deepEqual(counts(),[1,0]);
 nodes.halfName1.children=[];render(base);a.deepEqual(counts(),[1,0]);
 render({...base,status:'finished'});a.deepEqual(counts(),[0,0]);
 render({...base,match_starter_id:null});a.deepEqual(counts(),[0,0]);
});
test('41 shortcuts hit 2 and miss 0 without changing payload or other rounds',()=>{
 const src=read('half-it-standard-41-buttons.js');
 let handler,clicks=[],exact=true;
 const noop=()=>{};
 const context={window:{},document:{createElement:()=>({}),head:{appendChild:noop},addEventListener:(name,fn)=>{handler=fn}},buildPad:noop,renderEntry:noop,currentRound:()=>exact?{type:'exact',target:41}:{type:'number',target:20},$:id=>({click:()=>clicks.push(id)}),setTimeout:noop};
 vm.runInNewContext(src,context);
 const press=(key)=>handler({key,preventDefault:noop,stopImmediatePropagation:noop,target:{}});
 for(const k of ['2','0','Enter','Backspace'])press(k);
 a.deepEqual(clicks,['halfExact41Hit','halfExact41Miss']);
 exact=false;press('2');press('0');a.equal(clicks.length,2);
 a.match(src,/TREFF <span class="da-key">2<\/span>/);a.match(src,/BOM <span class="da-key">0<\/span>/);
 a.match(src,/\[\{n:20,mult:1\},\{n:20,mult:1\},\{n:1,mult:1\}\]/);
});
test('Both engines and multileg render path use shared starter UI with fresh assets',()=>{
 const h=read('half-it.html'),b=read('half-it-bootstrap.js');
 a.ok(h.indexOf('src="x01-leg-starter-marker.js')<h.indexOf('src="half-it-online-layout.js'));
 for(const p of ['half-it-standard.js','half-it.js','half-it-multileg.js']){
   a.match(read(p),/DartArenaHalfItStarter\?\.render\(m\)/);a.ok(b.includes(p+'?v=20261125-enter-autofill1'));
 }
});
