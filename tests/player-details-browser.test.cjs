const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync('player.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const source=fs.readFileSync('player-details.js','utf8');const avatarSource=fs.readFileSync('profile-avatars.js','utf8');const presentationSource=fs.readFileSync('profile-name-link.js','utf8');
test('Empty own profile, save, fresh read, other profile read-only and literal user text',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 await p.route('https://profile.invalid/**',r=>r.fulfill({contentType:'text/html',body:html}));
 async function setup(id,record,staff=false){
  await p.goto('https://profile.invalid/player.html?id='+id);
  await p.evaluate(({record,staff})=>{
   document.getElementById('playerName').textContent='Åse';
   window.record=record;window.writes=[];
   window.DartArenaSupabaseClient={
    auth:{getSession:async()=>({data:{session:{user:{id:'own'}}}})},
    from:table=>({select(){return this},eq(){return this},async maybeSingle(){return{data:table==='profiles'?{username:window.record?.nickname||'Åse',nickname_changed_at:window.record?'2026-11-25':null}:window.record}}}),rpc:async(name,args)=>{if(name==='is_admin')return{data:staff};const row=Object.fromEntries(Object.entries(args).map(([k,v])=>[k.slice(2),v]));row.user_id=args.p_user_id||'own';writes.push(row);window.record=row;return{data:row.nickname}}
   };
  },{record,staff});
  await p.addScriptTag({content:avatarSource});
  await p.addScriptTag({content:presentationSource});
  await p.addScriptTag({content:source});
  await p.locator('#playerDetails').waitFor({state:'visible'});
 }
 await setup('own',null);
 a.equal(await p.locator('#profileAvatar').textContent(),'Å');
 await p.locator('#editPlayerDetails').click();
 await p.locator('input[name=nickname]').fill('Ace');
 await p.locator('input[name=club]').fill('Dart Club');
 await p.locator('input[name=full_name]').fill('Example Name');
 await p.locator('select[name=display_mode]').selectOption('both');
 a.equal(await p.locator('#displayNamePreview').textContent(),'Example Name «Ace»');
 await p.locator('textarea[name=bio]').fill('<img src=x onerror=alert(1)>');
 await p.locator('#savePlayerDetails').click();
 await p.waitForFunction(()=>writes.length===1&&!document.getElementById('playerDetailsDialog').open);
 const row=await p.evaluate(()=>record);
 a.equal(row.user_id,'own');a.equal(row.club,'Dart Club');a.equal(row.display_mode,'both');a.equal(await p.locator('#playerName').textContent(),'Example Name «Ace»');
 a.equal(await p.locator('#playerBio').textContent(),row.bio);
 a.equal(await p.locator('#playerBio img').count(),0);
 await setup('own',row);a.match(await p.locator('#playerDetailsSummary').textContent(),/Dart Club/);
 await setup('other',row);a.equal(await p.locator('#editPlayerDetails').isVisible(),false);
 a.equal(await p.evaluate(()=>writes.length),0);
 a.equal(await p.locator('#playerBio').textContent(),row.bio);
 await setup('other',row,true);a.equal(await p.locator('#editPlayerDetails').isVisible(),true);
 await p.locator('#editPlayerDetails').click();await p.locator('input[name=nickname]').fill('StaffFixed');p.once('dialog',dlg=>dlg.accept());
 await p.locator('#savePlayerDetails').click();await p.waitForFunction(()=>writes.length===1&&!document.getElementById('playerDetailsDialog').open);
 a.equal(await p.evaluate(()=>writes[0].user_id),'other');a.equal(await p.locator('#playerName').textContent(),'Example Name «StaffFixed»');
 }finally{await browser.close()}
});
