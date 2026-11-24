// Isolated PostgreSQL parity and tamper rejection tests. No production credentials.
const E=require('../pentathlon-2p-engine.js');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const q=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const clean=s=>{const x=JSON.parse(JSON.stringify(s));delete x.undo;return x};
const slim=(s,old)=>({...clean(s),undo:old?[clean(old)]:[]});
let count=0, rejected=0;
function run(sql){return execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-q','-At'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']})}
function verify(s){run('select dartarena_internal.pentathlon_validate('+q(s)+');');count++}
function reject(s){try{verify(s)}catch(e){if(!String(e.stderr).includes('PENTATHLON_'))throw e;rejected++;return}throw Error('Tampered state accepted')}
const players=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'];
function actor(slot){return "select set_config('test.actor','"+players[slot]+"',false);"}
function insert(s){run(actor(s.firstStarter)+" insert into public.pentathlon_room_tests(id,player1_id,player2_id,state,version) values (1,'"+players[0]+"','"+players[1]+"',"+q(s)+",1);")}
function transition(s,slot,advance=false){run(actor(slot)+" update public.pentathlon_room_tests set state="+q(s)+",version=version+1,last_actor="+(advance?'null':"'"+players[slot]+"'")+" where id=1;");count++}
function denied(s,slot){try{transition(s,slot)}catch(e){if(!String(e.stderr).includes('PENTATHLON_'))throw e;rejected++;return}throw Error('Tampered transition accepted')}
function mutate(s,f){const x=JSON.parse(JSON.stringify(s));f(x);return x}
let s=E.create({name1:'A',name2:'B',starter:0});insert(s);verify(s);
let next=slim(E.submitX01(s,{score:180}),s);
denied(mutate(next,x=>x.current.pent[0]+=100),0);
denied(mutate(next,x=>x.undo[0].total[0]=1000),0);
denied(next,1);
transition(next,0);s=next;
let u=slim(E.undo(s));transition(u,0);s=u;
next=slim(E.submitX01(s,{score:180}),s);transition(next,0);s=next;
next=slim(E.submitX01(s,{score:60}),s);transition(next,1);s=next;
const corr=E.correctX01Visit(s,0,140,0);transition(corr,0);s=corr;
let step=0;
while(s.status!=='finished'&&step++<400){
 if(s.status==='review'){
  const n=slim(E.nextStage(s));transition(n,0,true);s=n;continue;
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
 transition(next,p);s=next;
}
assert.equal(s.status,'finished');assert.equal(s.summaries.length,7);verify(s);
reject(mutate(s,x=>x.total[0]+=1000));
reject(mutate(s,x=>x.summaries[0].pent[0]+=1000));
reject(mutate(s,x=>x.summaries[4].entries[0].bonus+=1000));
console.log(JSON.stringify({validChecks:count,rejected,final:s.total,stages:s.summaries.map(x=>x.id)}));
