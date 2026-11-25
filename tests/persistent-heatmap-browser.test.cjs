const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const src=p=>fs.readFileSync(p,'utf8');
test('New history and tournament statistics tabs read saved points for both players without session cache',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const kind of ['match','tournament']){
  const context=await browser.newContext(),p=await context.newPage();
  await p.route('http://dartarena.test/**',route=>route.fulfill({contentType:'text/html',body:'<body data-stats-source="'+kind+'"><main id="statsView"><section class="premium-result-card"><div class="premium-result-sub">501</div><div class="premium-player-grid"><article class="premium-player-card" data-player-id="a"><b class="premium-player-name">A</b></article><article class="premium-player-card" data-player-id="b"><b class="premium-player-name">B</b></article></div></section></main></body>'}));
  await p.goto('http://dartarena.test/'+kind+'-stats.html?id=archive-id');
  await p.evaluate(()=>{window.reads=[];window.DartArenaHeatmapChart={draw(c,points){c.dataset.n=points.length}};window.client={from(table){return{select(){return this},async eq(key,value){reads.push([table,key,value]);return{data:[{player_id:'a',points:[{u:.1,v:-.5,time:'2026-11-25T12:00:00.000Z',tipDetected:true}]},{player_id:'b',points:[{u:.2,v:-.4,time:'2026-11-25T12:00:01.000Z',tipDetected:false},{u:.3,v:-.4,time:'2026-11-25T12:00:02.000Z',tipDetected:true}]}]}}}}}});
  await p.addScriptTag({content:src('heatmap-storage.js')});await p.addScriptTag({content:src('premium-heatmap-view.js')});
  await p.evaluate(()=>DartArenaPremiumHeatmap.mount('actual-live-match-id',client));
  await p.waitForFunction(()=>[...document.querySelectorAll('.premium-hm-player canvas')].map(c=>c.dataset.n).join(',')==='1,2');
  a.deepEqual(await p.evaluate(()=>reads),[['match_heatmaps','match_id','actual-live-match-id']]);
  a.equal(await p.evaluate(()=>sessionStorage.length),0);
  a.equal(await p.locator('.premium-hm-section').count(),1);
  await p.evaluate(()=>DartArenaPremiumHeatmap.mount('actual-live-match-id',client));
  a.equal(await p.locator('.premium-hm-section').count(),1);
  await context.close();
 }
 }finally{await browser.close()}
});
test('Personal profile aggregates all accepted 501 results and filters the chosen period, with no opponent profile section',async()=>{
 const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage();await p.route('http://dartarena.test/**',r=>r.fulfill({contentType:'text/html',body:'<section id="personalHeatmap" hidden><select><option value="30">30</option><option value="all">All</option></select><canvas></canvas><p></p></section>'}));await p.goto('http://dartarena.test/player.html?id=me');
 await p.evaluate(()=>{window.requests=[];window.supabase={};window.DartArenaHeatmapChart={draw(c,points,weighted){c.dataset.count=points.reduce((n,p)=>n+p.weight,0);c.dataset.weighted=weighted}};const point={u:.1,v:.2,time:'2026-11-25T12:00:00.000Z',tipDetected:true};const row=(m)=>({points:[point],matches:{game_variant:'x01',game_config:null,is_warmup:false,...m}});window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:'me'}}}})},from(table){const query={select(){return this},eq(k,v){requests.push([k,v]);return this},is(){return this},order(){return this},range(){return this},gte(k,v){requests.push([k,v]);return this},then(resolve){resolve({data:[row({}),row({is_warmup:true}),row({game_config:{chicago:true}}),row({game_variant:'cricket'})]})}};return query}}});
 await p.addScriptTag({content:src('heatmap-storage.js')});await p.addScriptTag({content:src('personal-heatmap.js')});
 await p.waitForFunction(()=>document.querySelector('canvas').dataset.count==='1');a.equal(await p.locator('#personalHeatmap').evaluate(e=>e.hidden),false);a.equal(await p.locator('canvas').getAttribute('data-weighted'),'true');a.ok(await p.evaluate(()=>requests.some(r=>r[0]==='matches.finished_at')));
 await p.selectOption('select','all');await p.waitForFunction(()=>requests.filter(r=>r[0]==='player_id').length===2);
 a.match(await p.locator('#personalHeatmap p').textContent(),/1 registrerte kameraestimater fra 1 kamper/);
 await p.goto('http://dartarena.test/player.html?id=other');await p.evaluate(()=>{window.supabase={};window.DartArenaHeatmapChart={draw(){}};window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:'me'}}}})}}});await p.addScriptTag({content:src('heatmap-storage.js')});await p.addScriptTag({content:src('personal-heatmap.js')});a.equal(await p.locator('#personalHeatmap').evaluate(e=>e.hidden),true);
 }finally{await browser.close()}
});
