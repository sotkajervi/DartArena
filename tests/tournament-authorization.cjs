const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const id=n=>"'00000000-0000-0000-0000-"+String(n).padStart(12,'0')+"'";
const owner=id(1),admin=id(2),a=id(3),b=id(4),outsider=id(5),tour=id(10),group=id(11),cup=id(12);
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const as=(u,sql)=>run("set test.actor="+u+";set role authenticated;"+sql);
let accepted=0,rejected=0;function good(f){f();accepted++}function bad(f,p){assert.throws(f,e=>p.test(String(e.stderr)));rejected++}
run("insert into public.user_roles values("+admin+",'admin');insert into public.tournaments values("+tour+","+owner+",'groups_setup','groups_cup'),("+cup+","+owner+",'cup_setup','cup');insert into public.tournament_groups values("+group+","+tour+",5);insert into public.tournament_group_players values("+tour+","+group+","+a+"),("+tour+","+group+","+b+");");
function ins(u,n,o={}){const {t=tour,s='group',g=group,r=1,m=n,p1=a,p2=b,best=5,status='pending',wo=false,w='null',live='null',legs='null',flag=false}=o;return as(u,"insert into public.tournament_matches(id,tournament_id,stage,group_id,round_no,match_no,player1_id,player2_id,best_of,status,is_wo,winner_id,live_match_id,player1_legs,is_final) values("+id(n)+","+t+",'"+s+"',"+g+","+r+","+m+","+p1+","+p2+","+best+",'"+status+"',"+wo+","+w+","+live+","+legs+","+flag+");")}
const denied=/row-level security/;
bad(()=>ins(outsider,20),denied);bad(()=>ins(owner,20,{status:'finished',w:a,legs:3}),denied);bad(()=>ins(owner,20,{live:id(999)}),denied);bad(()=>ins(owner,20,{p2:outsider}),denied);bad(()=>ins(owner,20,{best:7}),denied);bad(()=>ins(owner,20,{p2:a}),denied);bad(()=>ins(owner,20,{flag:true}),denied);
good(()=>ins(owner,20));
run("update public.tournaments set status='groups' where id="+tour);
bad(()=>ins(owner,21),denied);
const cp={t:cup,s:'cup',g:'null'};
bad(()=>ins(owner,30,{...cp,status:'finished',w:a}),denied);bad(()=>ins(owner,30,{...cp,status:'wo',wo:true,w:a}),denied);bad(()=>ins(owner,30,{...cp,p2:'null',status:'wo',wo:true,w:b}),denied);
good(()=>ins(owner,30,{...cp,m:1}));
good(()=>ins(admin,31,{...cp,m:2,p2:'null',status:'wo',wo:true,w:a}));
good(()=>ins(owner,32,{...cp,r:2,m:1,p1:'null',p2:'null'}));
assert.equal(run("select count(*) from public.tournament_matches where tournament_id="+cup+" and is_final"),'1');
run("update public.tournaments set status='cup' where id="+cup+";update public.tournament_matches set player1_id="+a+",player2_id="+b+" where id="+id(32));
const update=(u,n,fields)=>as(u,"update public.tournament_matches set "+fields+" where id="+id(n)+" returning id;");
bad(()=>update(owner,30,'best_of=7'),/DA_FINAL_FORMAT_LOCKED/);
bad(()=>update(owner,30,'is_final=true'),/DA_INVALID_FINAL_FLAG/);
assert.equal(update(outsider,32,'best_of=7'),'');
good(()=>update(a,32,'best_of=7'));assert.equal(run("select best_of from public.tournament_matches where id="+id(32)),'7');
bad(()=>update(a,32,'winner_id='+a),/permission denied/);
bad(()=>update(owner,32,'is_final=false'),/DA_INVALID_FINAL_FLAG/);
run("update public.tournament_matches set status='finished' where id="+id(32));
bad(()=>update(owner,32,'best_of=9'),/DA_FINAL_FORMAT_LOCKED/);
bad(()=>ins(owner,33,cp),denied);
console.log(JSON.stringify({accepted,rejected,finalSync:true,finalistFormat:true,outsiderDenied:true}));
