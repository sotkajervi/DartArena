const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
test('Tournament participant rows show selected name, single avatar and adjacent owner badge',async()=>{
 const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage({viewport:{width:390,height:850}});
 await p.route('https://test.invalid/**',r=>r.fulfill({contentType:'text/html',body:read('tournament.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'')}));
 await p.goto('https://test.invalid/tournament.html?id=test');
 await p.addStyleTag({content:read('style.css')});
 await p.evaluate(()=>{
  window.ownerId='11111111-1111-4111-8111-111111111111';window.playerId='22222222-2222-4222-8222-222222222222';
  window.supabase={createClient:()=>({from(table){const data=table==='player_details'?[{user_id:ownerId,full_name:'Full Name',display_mode:'full'},{user_id:playerId,full_name:'Hidden Name',display_mode:'nick'}]:table==='player_avatars'?[{user_id:ownerId}]:[];return{select(){return this},in(){return Promise.resolve({data})}}},storage:{from(){return{createSignedUrls:async()=>({data:[{path:ownerId+'/avatar.jpg',signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}]})}}}})};
 });
 await p.addScriptTag({content:read('profile-name-link.js')});await p.addScriptTag({content:read('profile-avatars.js')});
 const source=read('tournament.js').split('boot().catch(error=>{')[0];
 await p.addScriptTag({content:source+`\nwindow.testRender=async()=>{names={[ownerId]:'OldNick',[playerId]:'Other'};await resolveTournamentNames([ownerId,playerId]);$('participantList').innerHTML=renderParticipantRows([{user_id:ownerId,role:'owner',playing:true},{user_id:playerId,role:'participant',playing:true}]);await DartArenaIdentity.paint(db,$('participantList'));const n=document.querySelector('.player-name');const badge=document.createElement('span');badge.className='player-role-badge owner';badge.textContent='OWNER';n.after(badge);return names[ownerId]};`});
 await p.addStyleTag({content:'.player-role-badge{display:inline-flex;margin-left:7px;padding:2px 6px;font-size:9px}'});
 a.equal(await p.evaluate(()=>testRender()),'OldNick');
 a.deepEqual(await p.locator('#participantList .player-name').allTextContents(),['Full Name','Other']);
 a.equal(await p.locator('#participantList .avatar').count(),2);
 a.equal(await p.locator('#participantList img[data-player-avatar]').count(),1);
 a.equal(await p.locator('#participantList .avatar').nth(1).textContent(),'O');
 const [n,b,s]=await Promise.all(['#participantList .player-name','#participantList .player-role-badge','#participantList .status'].map(x=>p.locator(x).first().boundingBox()));
 a.ok(Math.abs(n.y+n.height/2-b.y-b.height/2)<8);a.ok(s.y>=b.y+b.height-2);
 }finally{await browser.close()}
});
test('Presentation is separate from ranking and shared across tournament surfaces',()=>{
 const main=read('tournament.js'),stats=read('tournament-stats.js'),cup=read('tournament-cup.js'),chat=read('lobby-chat.js');
 a.match(main,/String\(names\[a.id\]\|\|''\)\.localeCompare\(String\(names\[b.id\]\|\|''\)\)/);
 a.match(stats,/a.name.localeCompare\(b.name,'nb'\)/);
 a.match(stats,/esc\(row.displayName\)/);a.match(stats,/esc\(r.displayName\)/);
 a.match(cup,/tournamentDisplayName\(playerId\)/);a.match(cup,/tournamentDisplayName\(final.winner_id\)/);
 a.match(chat,/tournamentPage&&window.DartArenaProfileLink/);
 a.ok(read('tournament.html').indexOf('profile-name-link.js')<read('tournament.html').indexOf('tournament.js?'));
});