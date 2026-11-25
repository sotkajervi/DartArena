const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync('player.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const source=fs.readFileSync('player-details.js','utf8');
test('Empty own profile, save, fresh read, other profile read-only and literal user text',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 await p.route('https://profile.invalid/**',r=>r.fulfill({contentType:'text/html',body:html}));
 async function setup(id,record){
  await p.goto('https://profile.invalid/player.html?id='+id);
  await p.evaluate(record=>{
   document.getElementById('playerName').textContent='Åse';
   window.record=record;window.writes=[];
   window.DartArenaSupabaseClient={
    auth:{getSession:async()=>({data:{session:{user:{id:'own'}}}})},
    from:()=>({select(){return this},eq(){return this},async maybeSingle(){return{data:window.record}},async upsert(row){writes.push(row);window.record=row;return{error:null}}})
   };
  },record);
  await p.addScriptTag({content:source});
  await p.locator('#playerDetails').waitFor({state:'visible'});
 }
 await setup('own',null);
 a.equal(await p.locator('#profileAvatar').textContent(),'Å');
 await p.locator('#editPlayerDetails').click();
 await p.locator('input[name=nickname]').fill('Ace');
 await p.locator('input[name=club]').fill('Dart Club');
 await p.locator('textarea[name=bio]').fill('<img src=x onerror=alert(1)>');
 await p.locator('#savePlayerDetails').click();
 await p.waitForFunction(()=>writes.length===1&&!document.getElementById('playerDetailsDialog').open);
 const row=await p.evaluate(()=>record);
 a.equal(row.user_id,'own');a.equal(row.club,'Dart Club');
 a.equal(await p.locator('#playerBio').textContent(),row.bio);
 a.equal(await p.locator('#playerBio img').count(),0);
 await setup('own',row);a.match(await p.locator('#playerDetailsSummary').textContent(),/Ace · Dart Club/);
 await setup('other',row);a.equal(await p.locator('#editPlayerDetails').isVisible(),false);
 a.equal(await p.evaluate(()=>writes.length),0);
 a.equal(await p.locator('#playerBio').textContent(),row.bio);
 }finally{await browser.close()}
});
