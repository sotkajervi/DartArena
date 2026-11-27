const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
test('Actual shared finished-match renderer uses selected display names, one avatar per player and winner crown',async()=>{
 const b=await chromium.launch({headless:true});
 try{
 for(const kind of ['match','tournament']){
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const file=kind==='match'?'match-stats.html':'tournament-match-stats.html';
  await p.route('https://result.invalid/**',r=>r.fulfill({contentType:'text/html',body:read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'')}));
  await p.goto('https://result.invalid/'+file+'?id=archive');
  await p.evaluate(({kind})=>{
   const p1='11111111-1111-4111-8111-111111111111',p2='22222222-2222-4222-8222-222222222222';
   const match={id:'live',status:'finished',player1_id:p1,player2_id:p2,winner_id:p2,player1_legs:0,player2_legs:3,game:501,legs:5,game_variant:'x01',finished_at:'2026-11-27'};
   const tm=kind==='tournament'?{id:'archive',live_match_id:'live',tournament_id:'tour',player1_id:p1,player2_id:p2,winner_id:p2,player1_legs:0,player2_legs:3,stage:'group'}:null;
   window.reads=[];window.client={auth:{getSession:async()=>({data:{session:{user:{id:p1}}}})},from(table){const data={matches:match,tournament_matches:tm,tournaments:{id:'tour',name:'Test tournament'},profiles:[{id:p1,username:'NickOne'},{id:p2,username:'NickTwo'}],player_details:[{user_id:p1,full_name:'Name One',display_mode:'full'},{user_id:p2,full_name:'Name Two',display_mode:'both'}],match_heatmaps:[]}[table];reads.push(table);return{select(){return this},in(){return Promise.resolve({data})},eq(){return this},single(){return Promise.resolve({data})},maybeSingle(){return Promise.resolve({data})},then(resolve){resolve({data})}}}};
   window.supabase={createClient:()=>client};
   window.DartArenaTournamentStatsFetch={fetchAllVisits:async()=>[]};window.DartArenaHeatmapChart={draw(){}};
  },{kind});
  for(const name of ['profile-name-link.js','heatmap-storage.js','premium-heatmap-view.js','premium-match-stats.js'])await p.addScriptTag({content:read(name)});
  await p.locator('.premium-hm-player').first().waitFor();
  await p.waitForFunction(()=>document.querySelectorAll('.premium-player-name .da-inline-avatar').length===2);
  a.equal(await p.locator('#statsTitle').textContent(),'Name Two «NickTwo» vs Name One');
  a.deepEqual(await p.locator('.premium-player-name .da-display-label').allTextContents(),['Name Two «NickTwo»','Name One']);
  a.deepEqual(await p.locator('.premium-hm-player strong').allTextContents(),['Name Two «NickTwo»','Name One']);
  a.equal(await p.locator('.premium-player-card.winner .premium-player-icon').textContent(),'♛');
  a.equal(await p.locator('.premium-player-card:not(.winner) .premium-player-icon').count(),0);
  a.equal(await p.locator('.premium-player-card:not(.winner) .da-inline-avatar').count(),1);
  a.equal(await p.locator('.premium-result-score').textContent(),'3–0');
  a.equal(await p.locator('.winner-name .da-display-label').textContent(),'Name Two «NickTwo»');
  a.equal(await p.locator('.premium-hm-player canvas').first().getAttribute('aria-label'),'Heatmap for Name Two «NickTwo»');
  a.deepEqual(errors,[]);await p.close();
 }
 }finally{await b.close()}
});