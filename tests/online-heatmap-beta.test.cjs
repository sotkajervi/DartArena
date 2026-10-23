'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const H=require('../autozoom/heatmap-math.js');
const Chart=require('../online-heatmap-chart.js');

test('heatmap calibration keeps D20 north even when the camera image is rotated',()=>{
 const board={x:550,y:350,radius:190,rotation:Math.PI/5};
 const target={x:board.x+board.radius*Math.sin(board.rotation),
   y:board.y-board.radius*Math.cos(board.rotation)};
 const p=H.normalize(board,target);
 assert.ok(Math.abs(p.u)<1e-8);
 assert.ok(Math.abs(p.v+1)<1e-8);
 assert.equal(H.normalize(board,{x:1500,y:1200}),null);
});

test('result heatmap blends red-yellow-green density over an intact board background',()=>{
 const width=200,height=200;
 const pixel=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<pixel.length;i+=4){pixel[i]=85;pixel[i+1]=90;pixel[i+2]=91;pixel[i+3]=255}
 let final=null;
 const noop=()=>{};
 const ctx={clearRect:noop,fillRect:noop,beginPath:noop,moveTo:noop,arc:noop,closePath:noop,
  fill:noop,stroke:noop,lineTo:noop,fillText:noop,
  getImageData(){return{data:new Uint8ClampedArray(pixel)}},
  putImageData(result){final=result.data}
 };
 Chart.draw({width,height,getContext:()=>ctx},[{u:0,v:-.5},{u:.02,v:-.52},{u:-.01,v:-.47}]);
 assert.ok(final,'The chart must produce a blended heatmap');
 assert.deepEqual(Array.from(final.slice(0,4)),[85,90,91,255],
  'Pixels outside the glow retain the board beneath');
 const center=(Math.round(height/2-(height*.395*.5))*width+Math.round(width/2))*4;
 assert.ok(final[center]>final[center+1],'Peak heat is red, not green');
});

test('X01 online keeps its match room clean while showing two heatmaps after finish',()=>{
 const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
 const collector=fs.readFileSync(path.join(root,'online-heatmap-result.js'),'utf8');
 const results=fs.readFileSync(path.join(root,'shared-results.js'),'utf8');
 assert.match(html,/online-heatmap-result\.js\?v=20261023-final1/);
 assert.match(html,/online-heatmap-chart\.js\?v=20261023-final1/);
 assert.match(html,/online-heatmap-result\.css\?v=20261023-final1/);
 assert.doesNotMatch(html,/online-heatmap-beta\.(js|css)/);
 assert.match(results,/DartArenaOnlineHeatmap\?\.attachResult\(overlay,m\)/);
 assert.match(collector,/result\.querySelector\('\.da-result-stats'\)/);
 assert.match(collector,/for\(const id of \[left,right\]\)/);
 assert.match(collector,/tipDetected/);
 assert.match(collector,/\.on\('broadcast',\{event:'heatmap-v1'\}/);
 assert.doesNotMatch(collector,/getUserMedia|\.rpc\(|\.insert\(|\.update\(/);
 assert.match(collector,/DartArenaX01ZoomSession\?\.sourceTrack/);
 assert.match(collector,/if\(!ownTurn\(\)\)/);
 assert.match(collector,/sessionStorage\.setItem/);
 for(const page of ['cricket.html','half-it.html','61-match.html']){
   assert.doesNotMatch(fs.readFileSync(path.join(root,page),'utf8'),/online-heatmap-result\.js/);
 }
});

test('the detector remains explicitly uncertain for an unchanged video frame',()=>{
 const w=100,h=70,frame=new Uint8ClampedArray(w*h*4);
 const p=H.infer(frame,frame,w,h,{x:50,y:32},{x:50,y:35,radius:28});
 assert.equal(p.tipDetected,false);
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
});


test('Realtime peer points appear in both final-result heatmaps without writing scores',async()=>{
 const vm=require('node:vm');
 const source=fs.readFileSync(path.join(root,'online-heatmap-result.js'),'utf8');
 const me='11111111-1111-4111-8111-111111111111';
 const opponent='22222222-2222-4222-8222-222222222222';
 const matchId='match-heatmap-test';
 const events={},sent=[],stored={},reads=[];
 function node(tag){
   return {tag,id:'',width:340,height:340,textContent:'',isConnected:true,children:[],attributes:{},
     setAttribute(k,v){this.attributes[k]=v},
     getAttribute(k){return this.attributes[k]},
     append(...x){this.children.push(...x)},appendChild(x){this.children.push(x)},
     getContext(){return{}},
     querySelector(selector){
       if(selector==='.da-result-hm-grid')return this.grid||(this.grid=node('grid'));
       if(selector==='canvas')return this.children.find(x=>x.tag==='canvas');
       if(selector==='.da-hm-caption')return this.children.find(x=>x.className==='da-hm-caption');
       return null;
     }};
 }
 const stat=node('div');
 stat.querySelector=()=>({textContent:'Spiller'});
 stat.insertAdjacentElement=(_,section)=>{stat.heatmap=section};
 const overlay={isConnected:true,
   querySelector(selector){return selector==='.da-result-stats'?stat:null},
   querySelectorAll(){return stat.heatmap?.grid?.children||[]}};
 const channel={on(_type,filter,handler){events[filter.event||filter.table]=handler;return this},
   subscribe(callback){callback('SUBSCRIBED');return this},
   send(message){sent.push(message);return Promise.resolve('ok')}};
 const client={
   auth:{async getSession(){return{data:{session:{user:{id:me}}},error:null}}},
   from(table){
     reads.push(table);
     return{select(){return this},eq(){return this},
       async single(){return{data:{id:matchId,player1_id:me,player2_id:opponent,
         status:'finished',game_variant:'x01',game_config:null},error:null}}}
   },
   channel(){return channel},removeChannel(){}
 };
 const window={
   supabase:{createClient(){return client}},
   DartArenaAutoZoom:{createChangeGate(){return{observe(){},reset(){}}}},
   DartArenaHeatmapMath:{},
   DartArenaHeatmapChart:{draw(canvas,points){canvas.pointCount=points.length}},
   DartArenaZoomCam:{},
   addEventListener(){}
 };
 const sessionStorage={getItem(key){return stored[key]||null},
   setItem(key,value){stored[key]=value}};
 vm.runInNewContext(source,{
   window,document:{createElement:node,getElementById(){return null}},
   location:{search:'?id='+matchId},URLSearchParams,
   sessionStorage,localStorage:{getItem(){return null}},
   setInterval(){return 5},clearInterval(){},console
 });
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.deepEqual(reads,['matches']);
 assert.ok(sent.some(x=>x.event==='heatmap-v1'),'Initial local snapshot is shared');
 assert.ok(sent.some(x=>x.event==='heatmap-request-v1'),'Peer heatmap is requested');
 events['heatmap-v1']({payload:{matchId,from:opponent,
   points:[{u:.02,v:-.6,tipDetected:true,time:'2026-10-23T12:00:00Z'}]}});
 window.DartArenaOnlineHeatmap.attachResult(overlay,{
   id:matchId,status:'finished',game_variant:'x01',
   player1_id:me,player2_id:opponent,winner_id:opponent
 });
 assert.equal(stat.heatmap.grid.children.length,2,'Exactly two player heatmaps');
 assert.equal(stat.heatmap.grid.children[0].getAttribute('data-heatmap-player'),opponent);
 assert.equal(stat.heatmap.grid.children[0].querySelector('canvas').pointCount,1);
 assert.equal(stat.heatmap.grid.children[1].querySelector('canvas').pointCount,0);
 assert.match(stat.heatmap.grid.children[1].querySelector('.da-hm-caption').textContent,/Ingen registrerte treff/);
 assert.equal(JSON.parse(stored['dartarena-x01-heatmap-result-v1:'+matchId])[opponent].length,1);
});
