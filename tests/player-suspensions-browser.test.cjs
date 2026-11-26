const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
test('staff can suspend and revoke from profile with mandatory reason; ordinary users cannot open staff controls',async()=>{
const b=await chromium.launch({headless:true});try{
const p=await b.newPage({viewport:{width:390,height:844}}),staff='33333333-3333-4333-8333-333333333333',target='11111111-1111-4111-8111-111111111111';
await p.route('https://suspend.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><button hidden id="suspendPlayerBtn">Suspensjon</button></body></html>'}));
await p.goto('https://suspend.invalid/player.html?id='+target);
await p.evaluate(({staff,target})=>{window.confirm=()=>true;window.mock={staff:true,rows:[],writes:[],error:null};window.DartArenaSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:staff}}}})},rpc:async(name,args)=>{if(name==='is_admin')return{data:mock.staff};if(mock.error)return{error:{message:mock.error}};mock.writes.push(args);if(args.p_action==='revoke'){mock.rows[0].revoked_at=new Date().toISOString();mock.rows[0].revocation_reason=args.p_reason}else mock.rows.unshift({id:'1',imposed_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),reason:args.p_reason});return{data:'1'}},from:table=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:target}}),order(){return this},limit:async()=>({data:mock.rows})})}}, {staff,target});
const script=path.join(__dirname,'../player-suspensions.js');
await p.addScriptTag({path:script});await p.locator('#suspendPlayerBtn').click();const x=p.locator('dialog[open]');
await x.getByRole('button',{name:'Suspender spiller'}).waitFor();await x.getByRole('button',{name:'Suspender spiller'}).click();a.equal(await p.evaluate(()=>mock.writes.length),0);
await x.getByRole('textbox').fill('Misconduct');await p.evaluate(()=>mock.error='active_play');await x.getByRole('button',{name:'Suspender spiller'}).click();await x.getByText(/Kan ikke suspendere/).waitFor();a.equal(await p.evaluate(()=>mock.writes.length),0);
await p.evaluate(()=>mock.error=null);await x.getByRole('combobox').selectOption('24h');await x.getByRole('button',{name:'Suspender spiller'}).click();await x.getByRole('button',{name:'Opphev suspensjon'}).waitFor();a.equal(await p.evaluate(()=>mock.writes[0].p_reason),'Misconduct');
await x.getByRole('textbox').fill('Reviewed');await x.getByRole('button',{name:'Opphev suspensjon'}).click();await x.getByText(/Opphevet: Reviewed/).waitFor();a.equal(await p.evaluate(()=>mock.writes[1].p_action),'revoke');
await x.getByRole('button',{name:'Lukk'}).click();await p.evaluate(()=>{mock.staff=false;document.getElementById('suspendPlayerBtn').hidden=true});await p.addScriptTag({path:script});await p.waitForTimeout(100);a.equal(await p.locator('#suspendPlayerBtn').isVisible(),false);
}finally{await b.close()}
});
