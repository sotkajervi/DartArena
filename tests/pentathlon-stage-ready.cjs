// Runs only against the isolated PostgreSQL service; no live credentials.
const {execFileSync,execFile}=require('node:child_process'),{promisify}=require('node:util'),assert=require('node:assert/strict');
const E=require('../pentathlon-2p-engine.js');
const fs=require('node:fs');
const psArgs=['-X','-v','ON_ERROR_STOP=1','-q','-At'];
const q=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const clean=s=>{const x=JSON.parse(JSON.stringify(s));delete x.undo;return x};
const slim=(s,old)=>({...clean(s),undo:old?[clean(old)]:[]});
const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000099'];
const challenge='00000000-0000-0000-0000-000000000010',match='00000000-0000-0000-0000-000000000011';
const run=sql=>execFileSync('psql',psArgs,{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim().split('\n').at(-1);
const statement=(slot,version,action,next)=>"select set_config('test.actor','"+ids[slot]+"',false);set role authenticated;select public.apply_pentathlon_room_test('"+challenge+"',"+version+",'"+action+"',"+q(next)+");";
const rpc=(slot,version,action,next)=>JSON.parse(run(statement(slot,version,action,next)));
const parallel=sql=>new Promise((resolve,reject)=>{const p=execFile('psql',psArgs,{encoding:'utf8',maxBuffer:8*1024*1024},(e,stdout,stderr)=>e?reject(Error(stderr)):resolve(JSON.parse(stdout.trim().split('\n').at(-1))));p.stdin.end(sql)});
const read=()=>JSON.parse(run("select to_jsonb(r) from public.pentathlon_room_tests r where challenge_id='"+challenge+"';"));
const reject=(fn,pattern)=>assert.throws(fn,e=>pattern.test(String(e.stderr||e.message)));
let checked=0;
async function main(){
 let s=E.create({name1:'A',name2:'B',starter:0});
 run("insert into public.challenges values ('"+challenge+"','accepted','"+ids[0]+"','"+ids[1]+"',now()-interval '1 minute');insert into public.matches(id,game_variant,status,player1_id,player2_id,match_starter_id,created_at) values ('"+match+"','pentathlon','playing','"+ids[0]+"','"+ids[1]+"','"+ids[0]+"',now());insert into public.profiles values ('"+ids[0]+"','playing'),('"+ids[1]+"','playing');");
 let r=JSON.parse(run("select set_config('test.actor','"+ids[0]+"',false);set role authenticated;select public.start_pentathlon_match_test('"+match+"','"+challenge+"',"+q(s)+");"));
 assert.equal(r.stage_ready_mask,0);
 const turn=next=>{const after=slim(next,r.state);const old=r;r=rpc(old.state.current.turn,old.version,'turn',after);assert.deepEqual(r.state,after);assert.equal(r.stage_ready_mask,0)};
 for(let i=0;i<7;i++){
   let guard=0;
   while(r.state.status==='playing'){
    assert(++guard<200);
    const c=r.state.current,p=c.turn;
    if(c.kind==='x01'){const rest=c.remaining[p],score=rest>170?(rest-180>=2?180:100):rest;turn(E.submitX01(r.state,rest<=170?{score,darts:3,doubleConfirmed:true}:{score}));}
    else if(c.kind==='shanghai'){const n=E.currentTarget(r.state).number;turn(E.submitShanghaiTurn(r.state,[{n,m:1},{n,m:2},{n,m:3}]));}
    else if(c.kind==='clock'){const n=E.currentTarget(r.state).number;turn(E.submitClockTurn(r.state,[{n,m:2}]));}
    else {let next=r.state;const t=E.currentTarget(next);for(let j=0;j<3;j++)next=E.submitDart(next,{n:t.number,m:t.mult||1});turn(next);}
   }
   assert.equal(r.state.status,'review');assert.equal(r.state.stageIndex,i);
   const before=r, next=slim(E.nextStage(before.state));
   if(i===0){
     reject(()=>rpc(2,before.version,'advance',next),/Pentathlon test not found/);
     const tampered=JSON.parse(JSON.stringify(next));tampered.total[0]+=99;
     reject(()=>rpc(0,before.version,'advance',tampered),/Cannot advance|PENTATHLON_/);
     // Actual concurrent requests from different players, carrying the same version.
     const both=await Promise.all([parallel(statement(0,before.version,'advance',next)),parallel(statement(1,before.version,'advance',next))]);
     assert.equal(both.filter(x=>x.state.status==='review').length,1);
     assert.equal(both.filter(x=>x.state.stageIndex===1).length,1);
     r=read();assert.deepEqual(r.state,next);
     reject(()=>rpc(0,before.version,'advance',next),/PENTATHLON_STALE_VERSION/);
   }else{
     const first=i%2,second=1-first;
     r=rpc(first,before.version,'advance',next);
     assert.deepEqual(r.state,before.state);assert.equal(r.stage_ready_mask,1<<first);assert.equal(r.last_actor,before.last_actor);assert.equal(r.version,before.version+1);
     assert.deepEqual(read(),r); // persisted on reconnect
     assert.deepEqual(rpc(first,before.version,'advance',next),r); // retry
     assert.deepEqual(rpc(first,r.version,'advance',next),r); // double click
     if(i===6)assert.equal(run("select status from public.matches where id='"+match+"';"),'playing');
     r=rpc(second,before.version,'advance',next); // other tab may still have old version
   }
   assert.equal(r.version,before.version+2);assert.equal(r.stage_ready_mask,0);assert.deepEqual(r.state,next);
   checked++;
 }
 assert.equal(r.state.status,'finished');
 assert.equal(run("select status from public.matches where id='"+match+"';"),'finished');
 assert.equal(run("select has_function_privilege('anon','public.apply_pentathlon_room_test(uuid,bigint,text,jsonb)','execute');"),'f');
 assert.equal(run("select has_table_privilege('authenticated','public.pentathlon_room_tests','update');"),'f');
 // Browser guards: review cannot be dismissed by backdrop/Escape, repeat submit blocked, stale response cannot rewind.
 const ui=fs.readFileSync('pentathlon-room-test.js','utf8');
 assert.match(ui,/const closeStage=\(\)=>\{\s*if\(game\(\)\?\.status==='review'\)return/);
 assert.match(ui,/\$\('ptCloseStageModal'\)\.hidden=review/);
 assert.match(ui,/saving\|\|ownReady\(\)/);
 assert.match(ui,/if\(!record\|\|data\.version>=record\.version\)record=data/);
 console.log(JSON.stringify({stages:checked,concurrentConfirm:true,duplicateSafe:true,persisted:true,outsiderDenied:true,finalRequiresBoth:true,anonDenied:true,uiGuards:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
