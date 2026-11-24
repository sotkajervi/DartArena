const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const actor='00000000-0000-0000-0000-000000000001';
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']})}
let passed=0,rejected=0;
function insert(g,v,s,d,user=actor){return run("select set_config('test.actor','"+actor+"',false);set role authenticated;insert into public.personal_training_results(user_id,game,variant,score,details) values ('"+user+"','"+g+"','"+v+"',"+s+","+q(d)+") returning score;").trim().split('\n').at(-1)}
function good(g,v,s,d){assert.equal(Number(insert(g,v,s,d)),s);passed++}
function bad(g,v,s,d,user){try{insert(g,v,s,d,user)}catch(e){assert.match(String(e.stderr),/TRAINING_|row-level security|check constraint/);rejected++;return}throw Error('Tampered record accepted')}
const clone=x=>JSON.parse(JSON.stringify(x));
const src61=fs.readFileSync('61.js','utf8');const match=src61.match(/function normalizeTarget\(v,result\)\{[\s\S]*?\}function render/);
assert.ok(match);const norm=vm.runInNewContext('('+match[0].slice(0,-'function render'.length)+')');
for(const mins of [10,20,30,45,60]){
 let t=61,best=0,attempts=[];
 for(let i=0;i<90;i++){const result=i%5===0?'miss':'hit',before=t;t=norm(t+(result==='hit'?5:-1),result);if(result==='hit')best=Math.max(best,before);attempts.push({result,before,after:t})}
 const d={duration_minutes:mins,end_target:t,attempts};
 good('61',String(mins),best,d);bad('61',String(mins),best+1,d);
 const x=clone(d);x.attempts[3].before+=1;bad('61',String(mins),best,x);
}
good('61','10',0,{duration_minutes:10,end_target:61,attempts:[]});
bad('61','5',0,{duration_minutes:5,end_target:61,attempts:[]});
bad('61','10',170,{duration_minutes:10,end_target:61});
bad('61','10',0,{duration_minutes:10,end_target:61,attempts:[]},'00000000-0000-0000-0000-000000000002');
const source=fs.readFileSync('half-it-solo.js','utf8');
const context=vm.createContext({URLSearchParams,location:{search:''}});
vm.runInContext(source.slice(0,source.indexOf('function currentRound'))+source.slice(source.indexOf('function evaluateRound'),source.indexOf('function submitRound')),context);
for(const variant of ['standard','dartcounter']){
 for(let scenario=0;scenario<6;scenario++){
  context.variant=variant;context.scenario=scenario;
  const result=vm.runInContext(`(()=>{
   mode=variant; const list=mode==='standard'?STANDARD_ROUNDS:DARTCOUNTER_ROUNDS;
   let score=0;const history=[];
   for(let i=0;i<12;i++){
    const r=list[i];exactTarget=r.type==='exact'?41:null;
    let darts=r.type==='number'?[{n:r.target,mult:3},{n:r.target,mult:1},{n:0,mult:0}]:
      r.type==='double'?[{n:25,mult:2},{n:20,mult:2},{n:0,mult:0}]:
      r.type==='treble'?[{n:20,mult:3},{n:19,mult:3},{n:0,mult:0}]:
      r.type==='bull'?[{n:25,mult:2},{n:25,mult:1},{n:0,mult:0}]:
      r.type==='same'?[{n:20,mult:3},{n:20,mult:2},{n:20,mult:3}]:
      r.type==='different'?[{n:20,mult:1},{n:1,mult:1},{n:20,mult:3}]:
      [{n:20,mult:1},{n:20,mult:1},{n:1,mult:1}];
    if(scenario===1||scenario>1&&(i+scenario)%3===0)darts=Array.from({length:3},()=>({n:0,mult:0}));
    if(r.type==='exact'&&darts.every(d=>d.n===0))exactTarget=null;
    const a=evaluateRound(r,darts),before=score;
    score=a.success?score+a.points:mode==='standard'?Math.ceil(score/2):Math.floor(score/2);
    history.push({round:i+1,target:r.type==='exact'?(exactTarget?'Eksakt '+exactTarget:'Eksakt score'):r.label,success:a.success,points:a.points,score,before,darts});
   }
   return JSON.stringify({score,details:{rounds:12,history}})
  })()`,context);
  const {score,details}=JSON.parse(result);good('half_it',variant,score,details);bad('half_it',variant,score+1,details);
  const x=clone(details);x.history[0].darts[0]={n:25,mult:3};bad('half_it',variant,score,x);
  const y=clone(details);y.history.pop();bad('half_it',variant,score,y);
 }
}
assert.throws(()=>run("set role authenticated; select dartarena_training_internal.validate_record('61','10',0,'{}');"),/permission denied/);
console.log(JSON.stringify({passed,rejected,variants:7,privateValidator:true}));
