const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const id=n=>"'00000000-0000-0000-0000-"+String(n).padStart(12,'0')+"'";
const A=id(1),B=id(2),X=id(3),Admin=id(4),Owner=id(5),T=id(10),F=id(11),C=id(12);
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const as=(u,sql)=>run("set test.actor="+u+";set role authenticated;"+sql);
let accepted=0,rejected=0;function good(f){const v=f();accepted++;return v}function bad(f,re){assert.throws(f,e=>re.test(String(e.stderr)));rejected++}
run("insert into public.user_roles values("+Admin+",'admin'),("+Owner+",'owner');insert into public.tournaments(id,name,owner_id,status) values("+T+",'Test',"+A+",'registration'),("+F+",'Finished',"+A+",'finished'),("+C+",'Cancelled',"+A+",'cancelled');insert into public.tournament_members values("+T+","+B+",'participant'),("+T+","+X+",'spectator'),("+F+","+B+",'participant'),("+C+","+B+",'participant');");
const transfer=(u,t,p)=>as(u,"select public.transfer_tournament_leader("+t+","+p+");");
const upd=(u,t,fields)=>as(u,"update public.tournaments set "+fields+" where id="+t+" returning id;");
for(const u of [A,B,X,Admin,Owner])bad(()=>upd(u,T,'owner_id='+B),/permission denied/);
for(const u of [B,X,Admin,Owner])bad(()=>transfer(u,T,B),/Bare nåværende/);
bad(()=>transfer(A,T,A),/Velg en annen/);bad(()=>transfer(A,T,X),/påmeldt deltaker/);
bad(()=>transfer(A,F,B),/avsluttet turnering/);bad(()=>transfer(A,C,B),/avsluttet turnering/);
good(()=>upd(A,T,"name='Updated',game=301,registration_open=false,status='groups_setup',updated_at=now()"));
assert.equal(good(()=>transfer(A,T,B)),B.slice(1,-1));
assert.equal(upd(A,T,"name='Unauthorized'"),'');rejected++;
bad(()=>transfer(A,T,X),/Bare nåværende/);
good(()=>upd(B,T,"status='groups',game_variant='x01'"));
good(()=>upd(Admin,T,"stats_enabled=false"));
good(()=>upd(Owner,T,"status='finished'"));
assert.equal(run("select archived_at is not null from public.tournaments where id="+T),'t');
good(()=>as(B,"insert into public.tournaments(id,name,owner_id) values("+id(20)+",'New',"+B+");"));
bad(()=>as(B,"insert into public.tournaments(id,name,owner_id) values("+id(21)+",'Invalid',"+A+");"),/row-level security/);
assert.equal(as(X,"select count(*) from public.tournaments"),'4');
assert.equal(run("select has_column_privilege('authenticated','public.tournaments','owner_id','UPDATE')"),'f');
assert.equal(run("select has_column_privilege('authenticated','public.tournaments','owner_id','INSERT')"),'t');
assert.equal(run("select has_function_privilege('anon','public.transfer_tournament_leader(uuid,uuid)','EXECUTE')"),'f');
console.log(JSON.stringify({accepted,rejected,previousLeaderDenied:true,adminManagementPreserved:true,autoArchivePreserved:true,anonymousDenied:true}));
