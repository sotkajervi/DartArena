const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),E=require('../pentathlon-2p-engine.js');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000099',ch='00000000-0000-0000-0000-000000000010',mid='00000000-0000-0000-0000-000000000011';
const ids=[a,b],q=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const run=s=>execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim().split('\n').at(-1);
const clean=s=>{const c=JSON.parse(JSON.stringify(s));delete c.undo;return c};
const auth=(actor,role='authenticated')=>"select set_config('test.actor','"+actor+"',false);set role "+role+";";
const apply=(actor,version,action,s)=>JSON.parse(run(auth(actor)+"select public.apply_pentathlon_room_test('"+ch+"',"+version+",'"+action+"',"+q(s)+");"));
const correction=(actor,version,s,role='authenticated')=>JSON.parse(run(auth(actor,role)+"select public.correct_pentathlon_half_dart('"+ch+"',"+version+","+q(s)+");"));
let passed=0,rejected=0;
function bad(fn){assert.throws(fn,e=>/PENTATHLON_|permission denied/.test(String(e.stderr||e.message)));rejected++}
run("insert into public.challenges values ('"+ch+"','accepted','"+a+"','"+b+"',now()-interval '1 minute');insert into public.matches(id,game_variant,status,player1_id,player2_id,match_starter_id,created_at) values ('"+mid+"','pentathlon','playing','"+a+"','"+b+"','"+a+"',now());insert into public.profiles values ('"+a+"','playing'),('"+b+"','playing');");
let r=JSON.parse(run(auth(a)+"select public.start_pentathlon_match_test('"+mid+"','"+ch+"',"+q(E.create({name1:'A',name2:'B',starter:0}))+");"));
const turn=next=>{r=apply(ids[r.state.current.turn],r.version,'turn',{...clean(next),undo:[clean(r.state)]});};
function advance(){const next={...clean(E.nextStage(r.state)),undo:[]};r=apply(a,r.version,'advance',next);assert.equal(r.stage_ready_mask,1);r=apply(b,r.version,'advance',next);assert.equal(r.stage_ready_mask,0)}
for(let i=0;i<6;i++){
 let guard=0;
 while(r.state.status==='playing'){
  assert.ok(++guard<200);
  const c=r.state.current,p=c.turn;
  if(c.kind==='x01'){const rest=c.remaining[p],score=rest>170?(rest-180>=2?180:100):rest;turn(E.submitX01(r.state,rest<=170?{score,darts:3,doubleConfirmed:true}:{score}));}
  else if(c.kind==='shanghai'){const n=E.currentTarget(r.state).number;turn(E.submitShanghaiTurn(r.state,[{n,m:1},{n,m:2},{n,m:3}]));}
  else {const n=E.currentTarget(r.state).number;turn(E.submitClockTurn(r.state,[{n,m:2}]));}
 }
 advance();
}
const miss={n:0,m:0};
function three(darts){let s=r.state;for(const d of darts)s=E.submitDart(s,d);turn(s)}
for(let round=0;round<7;round++){
 // Register all misses for A, then correct its last dart while B has the turn.
 assert.equal(r.state.current.turn,0);
 const target=E.currentTarget(r.state);three([miss,miss,miss]);
 const old=r,idx=r.state.current.entries.length-1;
 const key=target.mult?2:3;
 const next=E.correctHalfDart(r.state,idx,key,0);
 assert.equal(next.current.turn,1);assert.deepEqual(next.total,old.state.total);
 assert.deepEqual(next.summaries,old.state.summaries);
 assert.equal(next.current.halfScores[1],old.state.current.halfScores[1]);
 if(round===0){
   bad(()=>correction(b,old.version,next));bad(()=>correction(outsider,old.version,next));bad(()=>correction(a,old.version-1,next));bad(()=>correction(a,old.version,next,'anon'));
   const tampered=JSON.parse(JSON.stringify(next));tampered.current.pent[0]+=999;bad(()=>correction(a,old.version,tampered));
   const totals=JSON.parse(JSON.stringify(next));totals.total[0]+=1;bad(()=>correction(a,old.version,totals));
   const changedOpponent=JSON.parse(JSON.stringify(next));changedOpponent.current.pent[1]+=1;bad(()=>correction(a,old.version,changedOpponent));
 }
 r=correction(a,old.version,next);assert.deepEqual(r.state,next);assert.equal(r.stage_ready_mask,0);passed++;
 // Correct back to miss; then restore. On later rounds this exercises halving.
 const back=E.correctHalfDart(r.state,idx,0,0);r=correction(a,r.version,back);assert.deepEqual(r.state,back);passed++;
 const restored=E.correctHalfDart(r.state,idx,key,0);r=correction(a,r.version,restored);assert.deepEqual(r.state,restored);passed++;
 if(target.mult)assert.throws(()=>E.correctHalfDart(r.state,idx,1,0),/Velg 2/);
 if(round>0)assert.throws(()=>E.correctHalfDart(r.state,0,2,0),/tre siste/);
 three([miss,miss,miss]);
}
assert.equal(r.state.status,'review');bad(()=>correction(a,r.version,r.state));advance();assert.equal(r.state.status,'finished');
assert.equal(run("select status from matches where id='"+mid+"'"),'finished');
console.log(JSON.stringify({passed,rejected,targets:7,stageReadyPreserved:true,opponentPreserved:true,finished:true}));
