const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
test('Profile heading uses real role renderer: Owner and Admin beside name, long names wrap, no badge for ordinary player',async()=>{
 const b=await chromium.launch({headless:true});
 try{
 const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const html=read('player.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
 await p.route('https://profile.invalid/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await p.goto('https://profile.invalid/player.html');
 await p.addStyleTag({content:read('style.css')});
 await p.addStyleTag({content:read('player-details.css')});
 await p.evaluate(()=>{
  window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},rpc:async()=>({data:[{user_id:'owner',role:'owner'},{user_id:'admin',role:'admin'}]}),from:()=>({select(){return this},async in(){return{data:[{id:'owner',username:'OwnerNick'},{id:'admin',username:'AdminNick'}]}}})};
  window.supabase={};
  const n=document.getElementById('playerName');n.dataset.userId='owner';n.textContent='Example Player';
 });
 await p.addScriptTag({content:read('role-visuals.js')});
 const heading=p.locator('#playerName'),badge=p.locator('.profile-name-row>.player-role-badge'),meta=p.locator('#playerMeta');
 await badge.waitFor();a.equal(await badge.textContent(),'OWNER');
 async function sameRow(){const h=await heading.boundingBox(),r=await badge.boundingBox(),m=await meta.boundingBox();a.ok(r.x>=h.x+h.width-1);a.ok(Math.abs((r.y+r.height/2)-(h.y+h.height/2))<3);a.ok(m.y>=r.y+r.height-1)}
 await sameRow();
 await p.evaluate(()=>{const n=document.getElementById('playerName');n.dataset.userId='admin';n.textContent='Another Player';window.DartArenaRoleVisuals.scan()});
 a.equal(await badge.textContent(),'ADMIN');await sameRow();
 await p.setViewportSize({width:390,height:844});await sameRow();
 await p.evaluate(()=>{document.getElementById('playerName').textContent='LongName'.repeat(10);window.DartArenaRoleVisuals.scan()});
 const bounds=await p.locator('.profile-name-row').boundingBox(),h=await heading.boundingBox(),r=await badge.boundingBox();
 a.ok(h.x+h.width<=bounds.x+bounds.width+1);a.ok(r.x+r.width<=bounds.x+bounds.width+1);
 await p.evaluate(()=>{document.getElementById('playerName').dataset.userId='ordinary';window.DartArenaRoleVisuals.scan()});
 a.equal(await badge.count(),0);a.deepEqual(errors,[]);
 }finally{await b.close()}
});