const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
test('Actual directory renderer retains role badges, selected metrics and mobile layout without duplicate columns',async()=>{
 const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const html=read('players.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
 await p.route('https://directory.invalid/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await p.goto('https://directory.invalid/players.html');
 await p.addStyleTag({content:read('style.css')});await p.addStyleTag({content:read('profile-name-link.css')});
 await p.evaluate(()=>{
  const owner='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',ordinary='33333333-3333-4333-8333-333333333333';
  const rows=[owner,admin,ordinary].map((user_id,i)=>({user_id,username:['OwnerNick','AdminNick','Ordinary'][i],matches:32-i,x01_avg:54.87-i,win_pct:43.8+i,c180:i,first9_avg:63.2-i,cricket_mpr:2.1,c100:7,c140:3,c170:1,highest_checkout:94,fastest_leg:15,registered_at:'2026-10-02'}));
  window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),onAuthStateChange(){}},rpc:async(name)=>({data:name==='get_player_directory_stats'?rows:name==='get_public_user_roles'?[{user_id:owner,role:'owner'},{user_id:admin,role:'admin'}]:false}),from(table){const data=table==='player_details'?[{user_id:owner,full_name:'Owner Name',display_mode:'full'},{user_id:admin,full_name:'Admin Name',display_mode:'full'}]:table==='profiles'?rows.map(r=>({id:r.user_id,username:r.username})):[];return{select(){return this},async in(){return{data}}}}};
  window.supabase={};
 });
 for(const file of ['profile-avatars.js','profile-name-link.js','players.js','role-visuals.js'])await p.addScriptTag({content:read(file)});
 const admin=p.locator('.directory-row[data-player-id="22222222-2222-4222-8222-222222222222"]');
 const owner=p.locator('.directory-row[data-player-id="11111111-1111-4111-8111-111111111111"]');
 await admin.locator('.player-role-badge').waitFor();
 await p.waitForFunction(()=>document.querySelector('.directory-row[data-player-id="22222222-2222-4222-8222-222222222222"] .directory-name')?.textContent==='Admin Name');
 a.equal(await admin.locator('.player-role-badge').textContent(),'ADMIN');
 a.equal(await owner.locator('.player-role-badge').textContent(),'OWNER');
 a.equal(await p.locator('.directory-row[data-player-id="33333333-3333-4333-8333-333333333333"] .player-role-badge').count(),0);
 async function checkBadge(row){const n=await row.locator('.directory-name').boundingBox(),r=await row.locator('.player-role-badge').boundingBox(),m=await row.locator('.directory-sub').boundingBox();a.ok(r.x>=n.x+n.width-1);a.ok(Math.abs(n.y+n.height/2-r.y-r.height/2)<3);a.ok(m.y>=r.y+r.height-1)}
 await checkBadge(admin);await checkBadge(owner);
 const opts=await p.locator('#playerSort option').evaluateAll(nodes=>nodes.map(n=>n.value));
 for(const key of opts){
  await p.selectOption('#playerSort',key);
  const labels=await admin.locator('.directory-stat small').allTextContents();
  a.equal(labels.length,new Set(labels).size,key+' no duplicate metrics');
  a.equal(labels.length,['name','x01_avg','matches','win_pct','c180'].includes(key)?4:5,key);
 }
 await p.setViewportSize({width:390,height:844});
 for(const key of opts){
  await p.selectOption('#playerSort',key);
  const labels=await admin.locator('.directory-stat:visible small').allTextContents();
  const expected={name:'501 AVG',x01_avg:'501 AVG',matches:'501 AVG',win_pct:'Seier',c180:'180',first9_avg:'FIRST 9',cricket_mpr:'CRICKET MPR',c100:'100+',c140:'140+',c170:'170+',highest_checkout:'HØYESTE CHECKOUT',fastest_leg:'RASKESTE LEG'}[key];
  a.deepEqual(labels,['501-kamper',expected],key);
 }
 await p.evaluate(()=>{const n=document.querySelector('.directory-row .directory-name');n.textContent='LongName'.repeat(10);DartArenaRoleVisuals.scan()});
 const wrap=await p.locator('.directory-row').first().evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));a.ok(wrap.scroll<=wrap.width+2);
 a.deepEqual(errors,[]);
 }finally{await b.close()}
});