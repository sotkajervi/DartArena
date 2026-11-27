const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
test('Player report dialog, evidence failure/retry, private staff tab and disposition',async()=>{
 const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),target='33333333-3333-4333-8333-333333333333',reporter='11111111-1111-4111-8111-111111111111';
 await p.route('https://report.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><h1 id="playerName">OldNick</h1><div id="profileAvatar"><img data-player-avatar></div><button hidden id="reportPlayerBtn">Rapporter spiller</button><div id="lobbyStatsActions"></div></body></html>'}));
 await p.goto('https://report.invalid/player.html?id='+target);
 await p.evaluate(({target,reporter})=>{
  localStorage.setItem('dartarena-language','en');window.mock={rows:[],staff:false,listener:null,failCapture:true};
  window.DartArenaIdentity={getUrls:async()=>new Map([[target,'https://image.invalid/avatar']])};
  window.fetch=async()=>{if(mock.failCapture)throw Error();return{ok:true,blob:async()=>new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'})}};
  window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:reporter}}}}),onAuthStateChange:f=>mock.listener=f},rpc:async(name,args)=>{if(name==='is_admin')return{data:mock.staff};mock.rows.push({id:'report-1',reporter_id:reporter,target_id:args.p_target_id,target_nickname:'OldNick',target_full_name:'Original Name',target_display_mode:'both',reporter_nickname:'Reporter',category:args.p_category,description:args.p_description,avatar_evidence:args.p_avatar_evidence,avatar_updated_at:new Date().toISOString(),created_at:new Date().toISOString(),status:'new',internal_note:''});return{error:null}},
   from:table=>({select:()=>{let id=null,filter=null;const q={eq:(k,v)=>{if(k==='id')id=v;else filter=v;return q},maybeSingle:async()=>({data:{id:target}}),order:()=>q,limit:()=>q,single:async()=>({data:mock.rows.find(r=>r.id===id)}),then:(resolve,reject)=>Promise.resolve({data:table==='player_reports'&&mock.staff?mock.rows.filter(r=>!filter||r.status===filter):[]}).then(resolve,reject)};return q},update:payload=>({eq:(k,id)=>({select:async()=>{Object.assign(mock.rows.find(r=>r.id===id),payload);return{data:[{id}]}}})})})};
 },{target,reporter});
 await p.addScriptTag({path:path.join(__dirname,'../issue-center.js')});
 await p.locator('#reportPlayerBtn').click();const modal=p.locator('dialog[open]');
 await modal.getByRole('heading',{name:'Report player'}).waitFor();a.equal(await modal.getByRole('combobox').locator('option').count(),7);
 await modal.getByRole('combobox').selectOption('avatar');await modal.getByRole('textbox').fill('<img src=x> evidence');
 await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Submit report'}).click();await modal.getByText(/Could not capture/).waitFor();a.equal(await p.evaluate(()=>mock.rows.length),0);
 await p.evaluate(()=>mock.failCapture=false);await modal.getByRole('button',{name:'Submit report'}).click();await modal.getByText('Report submitted. Thank you!').waitFor();a.equal(await p.evaluate(()=>mock.rows[0].avatar_evidence),'/9j/AA==');a.equal(await p.evaluate(()=>mock.rows[0].target_id),target);
 await modal.getByRole('button',{name:'Close'}).click();a.equal(await p.locator('#daIssueAdminBtn').count(),0);
 await p.evaluate(()=>{mock.staff=true;mock.listener()});await p.locator('#daIssueAdminBtn').click();await modal.getByRole('button',{name:'Player reports'}).click();
 const row=modal.locator('.da-issue-row');await row.getByText('Reported player: OldNick · Original Name').waitFor();await row.getByText('<img src=x> evidence',{exact:true}).waitFor();a.equal(await row.locator('img').count(),0);await row.getByRole('button',{name:'Open'}).click();await row.getByText(/not independently verified/).waitFor();a.equal(await row.locator('img').count(),1);
 await row.getByRole('combobox').selectOption('dismissed');await row.getByRole('textbox').fill('Reviewed');await row.getByRole('button',{name:'Save'}).click();await row.getByText('Inappropriate profile picture · dismissed').waitFor();a.equal(await p.evaluate(()=>mock.rows[0].internal_note),'Reviewed');
 }finally{await b.close()}
});
