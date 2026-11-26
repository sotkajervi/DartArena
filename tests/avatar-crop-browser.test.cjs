const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync('player.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'').replace('</head>','<style>'+fs.readFileSync('player-details.css','utf8')+'</style></head>');
const scripts=['profile-avatars.js','avatar-crop.js','player-details.js'].map(p=>fs.readFileSync(p,'utf8'));
test('Real image crop, zoom, drag, rotate, cancel and actual JPEG bytes uploaded',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}});const id='11111111-1111-4111-8111-111111111111';
 await p.route('https://profile.invalid/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await p.goto('https://profile.invalid/player.html?id='+id);
 const png=await p.evaluate(id=>{
  window.writes=[];window.meta=false;
  document.getElementById('playerName').textContent='Ace';
  window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id}}}})},rpc:async()=>({data:false}),
   from:table=>({select(){return this},eq(){return this},async maybeSingle(){return{data:table==='profiles'?{username:'Ace'}:null}},async in(){return{data:window.meta?[{user_id:id}]:[]}},async upsert(){window.meta=true;return{error:null}}}),
   storage:{from:()=>({async upload(path,blob,options){const bmp=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0);const pixel=Array.from(ctx.getImageData(128,128,1,1).data);writes.push({path,size:blob.size,type:blob.type,width:bmp.width,height:bmp.height,pixel,options});bmp.close();window.savedUrl=URL.createObjectURL(blob);return{error:null}},async createSignedUrls(){return{data:[{path:id+'/avatar.jpg',signedUrl:window.savedUrl}]}}})}
  };
  const c=document.createElement('canvas');c.width=768;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f00000';ctx.fillRect(0,0,256,256);ctx.fillStyle='#00d000';ctx.fillRect(256,0,256,256);ctx.fillStyle='#0000f0';ctx.fillRect(512,0,256,256);return c.toDataURL('image/png').split(',')[1];
 },id);
 for(const content of scripts)await p.addScriptTag({content});
 await p.locator('#playerDetails').waitFor({state:'visible'});
 const input=p.locator('#avatarFile'),dialog=p.locator('#avatarCropDialog'),canvas=p.locator('#avatarCropCanvas');
 const choose=async()=>{await input.setInputFiles({name:'color-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await dialog.waitFor({state:'visible'})};
 const pixel=()=>canvas.evaluate(c=>Array.from(c.getContext('2d').getImageData(128,128,1,1).data));
 await choose();a.deepEqual(await pixel(),[0,208,0,255]);a.equal(await p.evaluate(()=>writes.length),0);
 await p.locator('#avatarCropRotate').click();await p.locator('#avatarCropReset').click();a.deepEqual(await pixel(),[0,208,0,255]);
 await p.locator('#avatarCropZoom').fill('2');a.equal(await p.locator('#avatarCropPercent').textContent(),'200 %');
 await p.locator('#avatarCropReset').click();
 const box=await canvas.boundingBox();await p.mouse.move(box.x+box.width*.1,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.95,box.y+box.height*.5,{steps:8});await p.mouse.up();a.ok((await pixel())[0]>200);
 await p.locator('#avatarCropCancel').click();await dialog.waitFor({state:'hidden'});a.equal(await p.evaluate(()=>writes.length),0);
 await choose();await p.locator('#avatarCropZoom').fill('2');await canvas.focus();for(let i=0;i<60;i++)await canvas.press('ArrowRight');const expected=await pixel();a.ok(expected[0]>200&&expected[1]<20);
 await p.locator('#avatarCropSave').click();await p.waitForFunction(()=>writes.length===1&&document.getElementById('avatarStatus').textContent==='Profilbilde lagret.');
 const row=await p.evaluate(()=>writes[0]);a.equal(row.path,id+'/avatar.jpg');a.equal(row.type,'image/jpeg');a.equal(row.width,256);a.equal(row.height,256);a.ok(row.size>0&&row.size<=102400);a.ok(row.pixel[0]>200&&row.pixel[1]<30);
 await p.locator('#profileAvatar img[data-player-avatar]').waitFor({state:'visible'});
 a.equal(await p.locator('#removeAvatar').isVisible(),true);
 }finally{await browser.close()}
});