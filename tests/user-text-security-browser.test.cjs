const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
const payload='<img src=x onerror="window.__unsafe=1"><b>test</b>';
test('actual chat and tournament renderers preserve malicious-looking text as literal text',async()=>{
 const b=await chromium.launch({headless:true});
 try{
  const p=await b.newPage();await p.setContent('<div id="dartChatMessages"></div><div id="tournaments"></div>');
  await p.evaluate(()=>{window.supabase={};window.DartArenaSupabaseClient={};window.__unsafe=0});
  await p.addScriptTag({content:read('lobby-chat-feed.js')});
  const chat=read('lobby-chat.js').split('  db.auth.getSession().then(')[0];
  await p.addScriptTag({content:chat+"window.testChat=(body)=>{names['user']=body;messages.set('1',{id:'1',sender_id:'user',body,created_at:'2026-11-27T00:00:00Z'});renderAll({forceBottom:true})};})();"});
  await p.evaluate(v=>window.testChat(v),payload);
  a.equal(await p.locator('.dart-chat-body').textContent(),payload);a.equal(await p.locator('.dart-chat-author').textContent(),payload);a.equal(await p.locator('#dartChatMessages img,#dartChatMessages b').count(),0);
  const tournament=read('tournaments.js').split('  // Realtime is primary.')[0];
  await p.addScriptTag({content:tournament+"window.testTournament=tournamentRow;})();"});
  await p.evaluate(v=>{document.getElementById('tournaments').innerHTML=window.testTournament({id:'11111111-1111-4111-8111-111111111111',name:v,starts_at:'2026-11-27T00:00:00Z',game:501,tournament_type:'groups_cup'},[],{archive:true,winnerName:v})},payload);
  a.equal(await p.locator('#tournaments .player-name').textContent(),payload);a.match(await p.locator('#tournaments .status').textContent(),/Vinner: <img/);a.equal(await p.locator('#tournaments img,#tournaments b').count(),0);a.equal(await p.evaluate(()=>window.__unsafe),0);
 }finally{await b.close()}
});
test('legacy CSV export neutralizes formula-like text without altering ordinary values',()=>{
 const s=read('match-history-export.js');const code=s.slice(s.indexOf('  const csv='),s.indexOf('  function boot()'));
 const csv=require('node:vm').runInNewContext(code+';csv');
 for(const v of ['=1+1','+1','-1','@SUM(1)','  =1','\ttext','\rtext','＝1'])a.equal(csv(v),'"\''+v+'"');
 a.equal(csv('Normal name'),'"Normal name"');a.equal(csv('A"B'),'"A""B"');a.equal(csv(-12),'"-12"');
});
