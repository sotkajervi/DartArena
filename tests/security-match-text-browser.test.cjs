const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8'), payload='<img src=x onerror="window.__unsafe=1"><b>test</b>';
function part(s,from,to){const i=s.indexOf(from),j=s.indexOf(to,i+from.length);a.ok(i>=0&&j>i,from);return s.slice(i,j)}
test('61 visit history uses text nodes and only recognized result classes',async()=>{
 const b=await chromium.launch({headless:true});try{
  const p=await b.newPage();await p.setContent('<div id="historyList"></div>');await p.evaluate(()=>window.__unsafe=0);
  const code=part(read('sixty-one-match.js'),'function renderHistory(){','function actionAllowedNow()');
  await p.addScriptTag({content:"const $=id=>document.getElementById(id);let visits=[],names={};"+code+"window.testHistory=(v)=>{visits=v;names={a:v[0]?.name};renderHistory()};"});
  await p.evaluate(v=>window.testHistory([{player_id:'a',name:v,leg_no:v,target_before:v,target_after:61,result:v}]),payload);
  a.equal(await p.locator('.sixty-one-history-row span').first().textContent(),'Leg '+payload);
  a.equal(await p.locator('.sixty-one-history-row span').nth(1).textContent(),payload+' • '+payload+' → 61');
  a.equal(await p.locator('.sixty-one-history-row strong').getAttribute('class'),'miss');
  a.equal(await p.locator('#historyList img,#historyList b').count(),0);
  await p.evaluate(()=>window.testHistory([{player_id:'a',name:'Ace',leg_no:2,target_before:61,target_after:66,result:'hit'}]));
  a.equal(await p.locator('.sixty-one-history-row strong').textContent(),'TREFF');a.equal(await p.locator('.sixty-one-history-row strong').getAttribute('class'),'hit');
  await p.evaluate(()=>window.testHistory([]));a.equal(await p.locator('#historyList').textContent(),'Ingen forsøk ennå.');a.equal(await p.evaluate(()=>window.__unsafe),0);
 }finally{await b.close()}
});
test('Cricket visit log preserves literal names and attribute boundaries',async()=>{
 const b=await chromium.launch({headless:true});try{
  const p=await b.newPage();await p.setContent('<div id="cricketVisitLog"></div>');await p.evaluate(()=>window.__unsafe=0);
  const code=part(read('cricket-keyboard-log.js'),'  function renderLog(){','  function startCorrection(');
  const escCode=read('cricket.js').split('\n').find(l=>l.startsWith('function esc('));
  a.ok(escCode);
  await p.addScriptTag({content:"const $=id=>document.getElementById(id);let visits=[],names={};const renderMpr=()=>{},canCorrect=()=>true,summary=()=> '20×3',expand=v=>v,startCorrection=()=>{};"+escCode+"\n"+code+"window.testCricket=v=>{names={a:v.name};visits=[v];renderLog()};"});
  await p.evaluate(v=>window.testCricket({player_id:'a',name:v,leg_no:v,visit_no:v,id:'1" onmouseover="window.__unsafe=1',points_scored:60,darts:[]}),payload);
  a.equal(await p.locator('.cricket-history-player').textContent(),payload);a.equal(await p.locator('.cricket-history-meta').textContent(),'L'+payload+' · #'+payload);a.equal(await p.locator('.cricket-history-edit').getAttribute('onmouseover'),null);a.equal(await p.locator('#cricketVisitLog img,#cricketVisitLog b').count(),0);a.equal(await p.evaluate(()=>window.__unsafe),0);
 }finally{await b.close()}
});
test('spectator presence renders supplied names as text, not HTML',async()=>{
 const b=await chromium.launch({headless:true});try{
  const p=await b.newPage();await p.route('https://spectator.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<button id="viewerCount"><span id="viewerCountNumber"></span></button>'}));await p.goto('https://spectator.invalid/?id=match');
  await p.evaluate(()=>{window.supabase={};window.DartArenaSupabaseClient={};window.__unsafe=0});
  const script=read('spectator-presence.js').split('  (async()=>{')[0];
  await p.addScriptTag({content:script+"window.testSpectators=names=>{ch={presenceState:()=>({users:names.map((username,i)=>({role:'spectator',user_id:String(i),username}))})};render()};})();"});
  await p.evaluate(v=>window.testSpectators([v,'Ace']),payload);
  a.equal(await p.locator('#viewerCountNumber').textContent(),'2');a.ok((await p.locator('.da-spectator-popover-name').allTextContents()).includes(payload));a.equal(await p.locator('.da-spectator-popover-list img,.da-spectator-popover-list b').count(),0);a.equal(await p.evaluate(()=>window.__unsafe),0);
 }finally{await b.close()}
});
