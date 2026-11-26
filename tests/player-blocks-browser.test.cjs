const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
test('Block/unblock from other profile and manage private list on own profile',async()=>{
 const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),me='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await p.route('https://block.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><button hidden id="blockPlayerBtn">Blokker utfordringer</button><button hidden id="managePlayerBlocksBtn">Blokkerte spillere</button><p id="playerBlockStatus"></p></body></html>'}));
 await p.addInitScript(({me,other})=>{
  window.confirm=()=>true;window.mock={blocked:sessionStorage.getItem('blocked')==='true',writes:[]};
  window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:me}}}})},rpc:async(name,args)=>{if(name!=='set_player_block')throw Error(name);mock.writes.push(args);mock.blocked=args.p_blocked;sessionStorage.setItem('blocked',String(mock.blocked));return{data:mock.blocked}},from:table=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='profiles'?{id:other}:mock.blocked?{blocked_id:other}:null}),order:async()=>({data:mock.blocked?[{blocked_id:other}]:[]}),in:async()=>({data:[{id:other,username:'Example Player'}]})})};
 },{me,other});
 const script=path.join(__dirname,'../player-blocks.js');
 await p.goto('https://block.invalid/player.html?id='+other);await p.addScriptTag({path:script});
 await p.locator('#blockPlayerBtn').click();await p.getByText('Direkte utfordringer er blokkert.',{exact:true}).waitFor();a.equal(await p.locator('#blockPlayerBtn').textContent(),'Fjern blokkering');
 await p.locator('#blockPlayerBtn').click();await p.getByText('Blokkering fjernet.',{exact:true}).waitFor();a.equal(await p.evaluate(()=>mock.blocked),false);
 await p.locator('#blockPlayerBtn').click();await p.getByText('Direkte utfordringer er blokkert.',{exact:true}).waitFor();
 await p.goto('https://block.invalid/player.html?id='+me);await p.addScriptTag({path:script});await p.locator('#managePlayerBlocksBtn').click();
 const modal=p.locator('dialog[open]');await modal.getByRole('link',{name:'Example Player'}).waitFor();a.equal(await p.locator('#blockPlayerBtn').isVisible(),false);
 await modal.getByRole('button',{name:'Fjern blokkering'}).click();await modal.getByText('Ingen blokkerte spillere.').waitFor();a.equal(await p.evaluate(()=>mock.blocked),false);
 }finally{await b.close()}
});
