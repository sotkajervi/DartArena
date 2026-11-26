const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
test('Actual history renderer links both players, keeps score/AVG and opens correct profile after nickname change',async()=>{
 const b=await chromium.launch({headless:true});
 try{
 const context=await b.newContext({viewport:{width:390,height:844}}),p=await context.newPage();
 const p1='11111111-1111-4111-8111-111111111111',p2='22222222-2222-4222-8222-222222222222',mid='33333333-3333-4333-8333-333333333333';
 await context.route('https://profile.invalid/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('match-history.html')?read('match-history.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''):'<p>Profile destination</p>'}));
 await p.goto('https://profile.invalid/match-history.html');
 await p.evaluate(()=>{window.DartArenaSupabaseClient={};window.DartArenaDialog={}});
 await p.addScriptTag({content:read('profile-name-link.js')});
 await p.addScriptTag({content:read('match-history.js').split('\nboot().catch(')[0]});
 await p.evaluate(({p1,p2,mid})=>{me=p1;allMatches=[{id:mid,player1_id:p1,player2_id:p2,player1_name:'Ace',player2_name:'<img src=x>',winner_id:p1,player1_legs:3,player2_legs:1,game:501,legs:5,game_variant:'x01',finished_at:'2026-11-25T21:00:00Z'}];render()},{p1,p2,mid});
 const links=p.locator('#historyList a.da-profile-link');a.equal(await links.count(),2);a.equal(await links.nth(0).getAttribute('href'),'player.html?id='+p1);a.equal(await links.nth(1).getAttribute('href'),'player.html?id='+p2);a.equal(await links.nth(1).textContent(),'<img src=x>');a.equal(await p.locator('#historyList img').count(),0);a.equal(await p.locator('.history-result').textContent(),'3–1');a.equal(await p.locator('[data-stats-id]').count(),1);
 await p.evaluate(()=>{allMatches[0].player1_name='NewNick';render()});a.equal(await links.first().textContent(),'NewNick');a.equal(await links.first().getAttribute('href'),'player.html?id='+p1);
 const popupPromise=p.waitForEvent('popup');await links.nth(1).click();const popup=await popupPromise;await popup.waitForLoadState();a.equal(new URL(popup.url()).searchParams.get('id'),p2);a.match(p.url(),/match-history.html$/);await popup.close();
 const statsPopupPromise=p.waitForEvent('popup');await p.locator('[data-stats-id]').click();const statsPopup=await statsPopupPromise;await statsPopup.waitForLoadState();a.match(statsPopup.url(),/match-stats.html/);a.equal(new URL(statsPopup.url()).searchParams.get('id'),mid);
 }finally{await b.close()}
});
