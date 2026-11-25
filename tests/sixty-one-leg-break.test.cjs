const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{chromium}=require('playwright');
const src=fs.readFileSync('sixty-one-leg-break.js','utf8'),c={};vm.createContext(c);vm.runInContext(src.slice(0,src.indexOf('(()=>{')),c);
const plain=v=>JSON.parse(JSON.stringify(v)),base={status:'playing',current_leg:1,player1_legs:0,player2_legs:0,player1_id:'a',player2_id:'b',match_starter_id:'a'};
test('Leg result uses server awarded winner, not checkout comparison, and never duplicates or replays final',()=>{
 const t=c.sixtyOneLegTransition();a.deepEqual(plain(t(base)),{});
 const next={...base,current_leg:2,player2_legs:1,match_starter_id:'b'};
 a.deepEqual(plain(t(next)),{data:{leg:1,nextLeg:2,legs:[0,1],ids:['a','b'],winnerId:'b',starterId:'b'}});
 a.deepEqual(plain(t(next)),{});a.deepEqual(plain(t({...next,status:'finished'})),{close:true});
 const reload=c.sixtyOneLegTransition();a.deepEqual(plain(reload(next)),{});
 a.deepEqual(plain(reload(base)),{close:true});
 a.deepEqual(plain(reload(next)).data.legs,[0,1]);
});
test('Checkout and attempt stats use committed leg visits',()=>{
 a.deepEqual(plain(c.sixtyOneLegStats([{player_id:'a',result:'hit',target_before:71},{player_id:'a',result:'miss',target_before:76},{player_id:'b',result:'hit',target_before:61}],['a','b'])),[{high:71,attempts:2},{high:61,attempts:1}]);
});
test('Enter closes only leg popup, numeric aliases work in active game and final closes popup',async()=>{
 const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage();await p.setContent('<body class="sixty-one-match-page"><button id="hitBtn">Hit</button><button id="missBtn">Miss</button><button id="pauseBtn">Pause</button><button id="undoBtn">Undo</button></body>');
 await p.addScriptTag({content:"var m="+JSON.stringify(base)+",profile={id:'a'},names={a:'A',b:'B'},matchId='test',hits=0,misses=0,render=()=>{},db={from:()=>({select:()=>({eq:()=>({eq:async()=>({data:[{player_id:'a',result:'hit',target_before:71},{player_id:'b',result:'hit',target_before:61}]})})})})};document.getElementById('hitBtn').onclick=()=>hits++;document.getElementById('missBtn').onclick=()=>misses++;"});
 for(const f of ['dartarena-dialog.css','sixty-one-online-layout.css'])await p.addStyleTag({content:fs.readFileSync(f,'utf8')});
 await p.addScriptTag({content:src});await p.addScriptTag({content:fs.readFileSync('sixty-one-shortcuts.js','utf8')});
 await p.evaluate(()=>{m={...m,current_leg:2,player2_legs:1,match_starter_id:'b'};render()});
 await p.waitForFunction(()=>document.getElementById('sixtyOneLegBreakDialog').open&&document.getElementById('sixtyOneLegScores').textContent.includes('71'));
 a.match(await p.locator('#sixtyOneLegWinner').textContent(),/B vant/);
 for(const key of ['2','0','Backspace','Enter'])await p.keyboard.press(key);
 a.deepEqual(await p.evaluate(()=>[hits,misses,document.getElementById('sixtyOneLegBreakDialog').open]),[0,0,false]);
 await p.keyboard.press('2');await p.keyboard.press('0');await p.keyboard.press('Enter');await p.keyboard.press('Backspace');
 a.deepEqual(await p.evaluate(()=>[hits,misses]),[2,2]);
 await p.evaluate(()=>{m={...m,current_leg:3,player1_legs:1};render()});a.ok(await p.locator('#sixtyOneLegBreakDialog').evaluate(e=>e.open));
 await p.evaluate(()=>{m.status='finished';render()});a.equal(await p.locator('#sixtyOneLegBreakDialog').evaluate(e=>e.open),false);
 }finally{await browser.close()}
});
