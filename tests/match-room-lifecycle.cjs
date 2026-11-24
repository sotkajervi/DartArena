const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const id=n=>"'00000000-0000-0000-0000-"+String(n).padStart(12,'0')+"'";
const A=id(1),B=id(2),X=id(3),G=id(10),C=id(11),T=id(12);
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const as=(u,sql)=>run("set test.actor="+u+";set role authenticated;"+sql);
let accepted=0,rejected=0;
function good(f){const v=f();accepted++;return v}
function bad(f,re){assert.throws(f,e=>re.test(String(e.stderr)));rejected++}
run("insert into public.profiles(id) values("+A+"),("+B+"),("+X+");insert into public.tournaments values("+G+",'groups',501,501,'x01','x01'),("+C+",'cup',501,501,'x01','x01'),("+T+",'cancelled',501,501,'x01','x01');");
function fixture(n,t=G,stage='group',status='pending'){run("insert into public.tournament_matches(id,tournament_id,stage,best_of,player1_id,player2_id,status) values("+id(n)+","+t+",'"+stage+"',3,"+A+","+B+",'"+status+"');")}
const start=(u,n,starter=A)=>as(u,"select public.start_tournament_match("+id(n)+","+starter+");");
const finish=(u,n,m)=>as(u,"select public.finish_tournament_match("+id(n)+",'"+m+"');");
const cancel=(u,n,m)=>as(u,"select public.cancel_tournament_match("+id(n)+",'"+m+"');");
fixture(20);fixture(21,G,'cup');fixture(22,C,'group');fixture(23,C,'cup');fixture(24,T);
bad(()=>start(X,20),/Not a player/);bad(()=>start(A,20,X),/Starter must/);bad(()=>start(A,21),/active phase/);bad(()=>start(A,22),/active phase/);bad(()=>start(A,24),/active phase/);
const m=good(()=>start(A,20));assert.equal(good(()=>start(B,20)),m);
bad(()=>finish(X,20,m),/Not a player/);bad(()=>cancel(X,20,m),/Not a player/);
bad(()=>finish(A,20,id(999).slice(1,-1)),/does not belong/);bad(()=>cancel(A,20,id(999).slice(1,-1)),/not the active/);
bad(()=>finish(A,20,m),/not finished/);
run("update public.matches set status='finished',player1_legs=2,player2_legs=0,winner_id="+A+" where id='"+m+"';");
bad(()=>cancel(A,20,m),/must be synchronized/);
good(()=>finish(B,20,m));
assert.equal(run("select player1_legs from public.tournament_matches where id="+id(20)),'2');
run("update public.tournament_matches set player1_legs=1,player2_legs=2,winner_id="+B+" where id="+id(20));
good(()=>finish(A,20,m));assert.equal(run("select player2_legs from public.tournament_matches where id="+id(20)),'2');
bad(()=>cancel(A,20,m),/not the active/);
const mc=good(()=>start(A,23));good(()=>cancel(B,23,mc));assert.equal(run("select status from public.tournament_matches where id="+id(23)),'pending');
const mc2=good(()=>start(A,23));run("update public.matches set status='cancelled' where id='"+mc2+"';");
good(()=>cancel(A,23,mc2));assert.equal(run("select status from public.tournament_matches where id="+id(23)),'pending');
const mc3=good(()=>start(A,23));run("update public.matches set player2_id="+X+" where id='"+mc3+"';");
bad(()=>start(A,23),/no longer available/);bad(()=>cancel(A,23,mc3),/player mismatch/);
run("update public.matches set player2_id="+B+",status='finished',deleted_at=now() where id='"+mc3+"';");
bad(()=>finish(A,23,mc3),/not finished/);bad(()=>cancel(A,23,mc3),/unavailable/);
assert.equal(run("select has_function_privilege('anon','public.start_tournament_match(uuid,uuid)','EXECUTE') or has_function_privilege('anon','public.finish_tournament_match(uuid,uuid)','EXECUTE') or has_function_privilege('anon','public.cancel_tournament_match(uuid,uuid)','EXECUTE')"),'f');
console.log(JSON.stringify({accepted,rejected,phaseEnforced:true,correctionPreserved:true,cancelRecovery:true,anonymousDenied:true}));
