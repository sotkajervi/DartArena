// Isolated PostgreSQL parity and tamper rejection tests. No production credentials.
const E=require('../pentathlon-2p-engine.js');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const q=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const clean=s=>{const x=JSON.parse(JSON.stringify(s));delete x.undo;return x};
const slim=(s,old)=>({...clean(s),undo:old?[clean(old)]:[]});
let count=0, rejected=0;
let rpcCount=0,rpcVersion=1,rpcState;
const challenge='00000000-0000-0000-0000-000000000010',match='00000000-0000-0000-0000-000000000011';
const cases=[];
function run(sql){return execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-q','-At'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']})}
function verify(s){run('select dartarena_internal.pentathlon_validate('+q(s)+');');count++}
function reject(s){try{verify(s)}catch(e){if(!String(e.stderr).includes('PENTATHLON_'))throw e;rejected++;return}throw Error('Tampered state accepted')}
const players=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'];
function actor(slot){return "select set_config('test.actor','"+players[slot]+"',false);"}
function insert(s){run(actor(s.firstStarter)+" insert into public.pentathlon_room_tests(id,player1_id,player2_id,state,version) values (1,'"+players[0]+"','"+players[1]+"',"+q(s)+",1);")}
function rpc(slot,fn,args){
 const out=run(actor(slot)+" set role authenticated; select public."+fn+"("+args+");").trim().split('\n').at(-1);
 return JSON.parse(out);
}
function startRPC(s){
 run("insert into public.challenges values ('"+challenge+"','accepted','"+players[0]+"','"+players[1]+"',now()-interval '1 minute');"+
 "insert into public.matches(id,game_variant,status,player1_id,player2_id,match_starter_id,created_at) values ('"+match+"','pentathlon','playing','"+players[0]+"','"+players[1]+"','"+players[s.firstStarter]+"',now());"+
 "insert into public.profiles values ('"+players[0]+"','playing'),('"+players[1]+"','playing');");
 const r=rpc(s.firstStarter,'start_pentathlon_match_test',"'"+match+"','"+challenge+"',"+q(s));
 assert.deepEqual(r.state,s);rpcState=s;rpcVersion=r.version;rpcCount++;
}
function shadow(s,slot,advance){
 const a=rpcState, before=a.current.entries, after=s.current.entries;
 let r,action=advance?'advance':'turn';
 const base="'"+challenge+"',"+rpcVersion;
 if(!advance&&s.undo.length===0&&a.undo.length===1&&require('node:util').isDeepStrictEqual(clean(s),a.undo[0]))action='undo';
 else if(!advance&&before.length===after.length){
  action='correct';
  if(['clock','shanghai'].includes(a.current.kind)){
   const idx=before.findIndex((e,i)=>e.hit!==after[i].hit);
   assert.ok(idx>=0);
   const m=after[idx].hit==='BOM'?0:({S:1,D:2,T:3})[after[idx].hit[0]];
   r=rpc(slot,a.current.kind==='clock'?'correct_pentathlon_clock_dart':'correct_pentathlon_shanghai_dart',base+','+idx+','+m);
  }
 }
 if(!r)r=rpc(slot,'apply_pentathlon_room_test',base+",'"+action+"',"+q(s));
 assert.deepEqual(r.state,s,'RPC state mismatch in '+a.current.kind+' '+action);
 assert.equal(Number(r.version),Number(rpcVersion)+1);
 rpcState=s;rpcVersion=r.version;rpcCount++;
}
function transition(s,slot,advance=false){run(actor(slot)+" update public.pentathlon_room_tests set state="+q(s)+",version=version+1,last_actor="+(advance?'null':"'"+players[slot]+"'")+" where id=1;");count++;shadow(s,slot,advance)}
function denied(s,slot){try{transition(s,slot)}catch(e){if(!String(e.stderr).includes('PENTATHLON_'))throw e;rejected++;return}throw Error('Tampered transition accepted')}
function expectDenied(label,sql,code){
 try{run(sql)}catch(e){assert.ok(String(e.stderr).includes(code),label+': '+String(e.stderr));rejected++;cases.push(label);return}
 throw Error(label+': unexpected acceptance');
}
function rawUpdate(state,slot,extra='version=version+1',actorSql=actor(slot)){
 return actorSql+" update public.pentathlon_room_tests set state="+q(state)+",last_actor='"+players[slot]+"',"+extra+" where id=1;";
}
function mutate(s,f){const x=JSON.parse(JSON.stringify(s));f(x);return x}
let s=E.create({name1:'A',name2:'B',starter:0});insert(s);startRPC(s);verify(s);
let next=slim(E.submitX01(s,{score:180}),s);
denied(mutate(next,x=>x.current.pent[0]+=100),0);
denied(mutate(next,x=>x.undo[0].total[0]=1000),0);
denied(next,1);
expectDenied('nonparticipant',rawUpdate(next,0,'version=version+1',"select set_config('test.actor','00000000-0000-0000-0000-000000000099',false);"),'PENTATHLON_ACCESS_DENIED');
expectDenied('missing actor',rawUpdate(next,0,'version=version+1',"select set_config('test.actor','',false);"),'PENTATHLON_ACCESS_DENIED');
expectDenied('stale version',rawUpdate(next,0,'version=version'),'PENTATHLON_INVALID_TRANSITION');
expectDenied('wrong last actor',rawUpdate(next,0).replace("last_actor='"+players[0]+"'","last_actor='"+players[1]+"'"),'PENTATHLON_INVALID_TRANSITION');
transition(next,0);s=next;
let u=slim(E.undo(s));transition(u,0);s=u;
next=slim(E.submitX01(s,{score:180}),s);transition(next,0);s=next;
next=slim(E.submitX01(s,{score:60}),s);transition(next,1);s=next;
const corr=E.correctX01Visit(s,0,140,0);denied(corr,1);transition(corr,0);s=corr;
// A legal replay from the engine must not permit the other player to undo a correction.
const undoCorrection=slim(E.undo(s));denied(undoCorrection,1);transition(undoCorrection,0);s=undoCorrection;
const recorrect=E.correctX01Visit(s,0,140,0);transition(recorrect,0);s=recorrect;
const correctedStages=new Set();let checkoutCases=0;
let step=0;
while(s.status!=='finished'&&step++<400){
 if(s.status==='review'){
  const n=slim(E.nextStage(s));
  denied(mutate(n,x=>x.summaries[0].pent[0]+=1),0);
  transition(n,0,true);s=n;continue;
 }
 const p=s.current.turn,old=s;
 if(s.current.kind==='x01'){
  const rest=s.current.remaining[p];
  let score=rest>180?100:rest<=170&&E.isCheckout(rest,3)?rest:Math.max(0,rest-40);
  if(step%7===0&&rest<180)score=180; // includes bust
  const d=score===rest&&E.isCheckout(score,3);
  next=E.submitX01(s,{score,darts:3,doubleConfirmed:d});
 }else{
  next=s;
  for(let i=0;i<3&&next.status==='playing'&&next.current.turn===p;i++){
   const t=E.currentTarget(next);
   const hit=next.current.kind==='shanghai'?{n:t.number,m:i+1}:next.current.kind==='clock'?(p===0||i!==1?{n:t.number,m:2}:{n:0,m:0}):{n:t.number,m:t.type==='double'?2:t.type==='triple'?3:1};
   next=E.submitDart(next,hit);
  }
 }
 next=slim(next,old);
 if(next.status==='review'&&old.current.kind==='x01'){
   const last=next.current.entries.at(-1);
   if(last.checkout&&!E.isCheckout(last.attempt,1)){
     const invalid=mutate(next,x=>{
       x.current.entries.at(-1).darts=1;
       x.summaries.at(-1).entries.at(-1).darts=1;
     });
     expectDenied('invalid one-dart checkout '+old.stageIndex,rawUpdate(invalid,p),'PENTATHLON_INVALID_CHECKOUT');checkoutCases++;
   }
 }
 transition(next,p);s=next;
 // Exercise valid corrections in both special games, reject correction by
 // the opponent, then undo and reapply using exactly the public engine.
 if(s.status==='playing'&&['shanghai','clock'].includes(s.current.kind)&&s.current.entries.length>=6&&!correctedStages.has(s.current.kind)){
   const kind=s.current.kind, editor=s.current.entries[0].player;
   const idx=s.current.entries.findIndex(e=>e.player===editor&&e.hit!=='BOM');
   const correct=kind==='shanghai'?E.correctShanghaiDart:E.correctClockDart;
   const changed=correct(s,idx,0,editor);
   denied(changed,1-editor);transition(changed,editor);s=changed;
   const undone=slim(E.undo(s));denied(undone,1-editor);transition(undone,editor);s=undone;
   const again=correct(s,idx,0,editor);transition(again,editor);s=again;
   correctedStages.add(kind);
 }
}
assert.equal(s.status,'finished');assert.equal(s.summaries.length,7);verify(s);
assert.equal(run("select status from public.matches where id='"+match+"';").trim(),'finished');
assert.equal(run("select winner_id from public.matches where id='"+match+"';").trim(),players[s.total[0]>s.total[1]?0:1]);
reject(mutate(s,x=>x.total[0]+=1000));
reject(mutate(s,x=>x.summaries[0].pent[0]+=1000));
reject(mutate(s,x=>x.summaries[4].entries[0].bonus+=1000));
assert.equal(correctedStages.size,2);
assert.ok(checkoutCases>0,'No impossible checkout fixture exercised');
denied(s,0);
denied(mutate(s,x=>x.undo=[clean(x)]),1);
// Verify score parity for every possible checkout amount and dart count.
// Build legal non-finishing prefixes with the browser engine; the SQL
// checker must reject exactly the checkout combinations the engine rejects.
const sqlTests=[];
for(let rest=2;rest<=170;rest++){
 let prefix=E.create({name1:'A',name2:'B',starter:0});
 let left=501-rest;
 while(left>0){
   let amount=Math.min(180,left);
   while(!E.isScore(amount)||left-amount===1)amount--;
   if(amount===0)amount=left; // left=1 avoided above
   prefix=E.submitX01(prefix,{score:amount});
   prefix=E.submitX01(prefix,{score:0});
   left-=amount;
 }
 for(let darts=1;darts<=3;darts++){
   const allowed=E.isCheckout(rest,darts);
   const entry=allowed?E.submitX01(prefix,{score:rest,darts,doubleConfirmed:true}).current.entries.at(-1):
     {player:0,type:'visit',attempt:rest,darts};
   sqlTests.push({rest,darts,allowed,log:[...prefix.current.entries,entry]});
 }
}
const parity=run(`create temporary table checkout_cases(payload jsonb);
insert into checkout_cases select value from jsonb_array_elements(${q(sqlTests)});
do $penttest$ declare r record; accepted boolean; begin
 for r in select payload as p from checkout_cases loop
  accepted:=true;
  begin
   perform dartarena_internal.pentathlon_replay(0,0,r.p->'log');
  exception when others then
   if sqlerrm not in ('PENTATHLON_INVALID_CHECKOUT','PENTATHLON_INVALID_SCORE') then raise;end if;
   accepted:=false;
  end;
  if accepted is distinct from (r.p->>'allowed')::boolean then
   raise exception 'checkout parity mismatch: % points / % darts',r.p->>'rest',r.p->>'darts';
  end if;
 end loop;
end $penttest$;
select count(*) from checkout_cases;`).trim();
assert.equal(Number(parity),507);
// Single-process DB timings; excludes client/network cost and is not a live load test.
const timings=run(`create temporary table validation_timings(ms double precision);
do $penttest$ declare v jsonb:=${q(s)}; t timestamptz; begin
 for i in 1..100 loop
  t:=clock_timestamp();
  perform dartarena_internal.pentathlon_validate(v);
  insert into validation_timings values (extract(epoch from clock_timestamp()-t)*1000);
 end loop;
end $penttest$;
select json_build_object('samples',count(*),'meanMs',round(avg(ms)::numeric,3),'p95Ms',round(percentile_cont(0.95) within group(order by ms)::numeric,3),'maxMs',round(max(ms)::numeric,3)) from validation_timings;`).trim();
console.log(JSON.stringify({validChecks:count,rpcChecks:rpcCount,rejected,checkoutParity:Number(parity),checkoutCases,correctedStages:[...correctedStages],cases,performance:JSON.parse(timings),final:s.total,stages:s.summaries.map(x=>x.id)}));
