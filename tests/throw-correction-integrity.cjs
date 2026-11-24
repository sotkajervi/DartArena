const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const id=n=>"'00000000-0000-0000-0000-"+String(n).padStart(12,'0')+"'";
const A=id(1),B=id(2),X=id(3);
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const as=(u,sql)=>run("set test.actor="+u+";set role authenticated;"+sql);
let accepted=0,rejected=0;function good(f){f();accepted++}function bad(f,re){assert.throws(f,e=>re.test(String(e.stderr)));rejected++}
function match(n,variant='x01',config='{}',status='playing'){run("insert into public.matches(id,player1_id,player2_id,game_variant,game_config,status,match_starter_id,turn_player_id) values("+id(n)+","+A+","+B+",'"+variant+"','"+config+"','"+status+"',"+A+","+B+");")}
function visit(n,m,player=A,score=40,leg=1){run("insert into public.match_throws(id,match_id,player_id,score,leg_no) values("+n+","+id(m)+","+player+","+score+","+leg+");")}
const correct=(u,n,s)=>as(u,"select public.correct_x01_throw("+n+","+s+");");
const checkout=(u,n,s,d)=>as(u,"select public.correct_throw_to_checkout("+n+","+s+","+d+");");
match(10);visit(1,10);bad(()=>correct(B,1,60),/own throw/);bad(()=>checkout(X,1,140,3),/own throw/);
bad(()=>correct(A,1,'null'),/Invalid three-dart/);bad(()=>correct(A,1,179),/Invalid three-dart/);bad(()=>checkout(A,1,140,1),/Invalid checkout/);bad(()=>checkout(A,1,140,'null'),/Invalid checkout/);bad(()=>checkout(A,1,'null',3),/Invalid checkout/);
good(()=>correct(A,1,60));assert.equal(run("select player1_score from public.matches where id="+id(10)),'80');
good(()=>checkout(A,1,140,3));assert.equal(run("select current_leg||':'||player1_legs from public.matches where id="+id(10)),'2:1');
bad(()=>correct(A,1,40),/Checkout throws|active leg/);
match(11,'x01','{"chicago":true}');visit(2,11);bad(()=>correct(A,2,60),/Chicago correction/);bad(()=>checkout(A,2,140,3),/Chicago correction/);
match(12,'cricket');visit(3,12);bad(()=>checkout(A,3,140,3),/not an X01/);
match(13,'x01','{}','finished');visit(4,13);bad(()=>correct(A,4,60),/active match/);bad(()=>checkout(A,4,140,3),/active leg/);
match(14);visit(5,14);visit(6,14,B);bad(()=>checkout(A,5,140,3),/later throws/);
match(15);for(let n=10;n<14;n++)visit(n,15);bad(()=>correct(A,10,60),/three latest/);good(()=>correct(A,11,60));
match(16);visit(20,16,A,40,2);bad(()=>correct(A,20,60),/active leg/);
match(17);visit(21,17);run("update public.matches set deleted_at=now() where id="+id(17));bad(()=>correct(A,21,60),/active match/);bad(()=>checkout(A,21,140,3),/active leg/);
const undo=(u,n)=>as(u,"select public.undo_sixty_one_last("+id(n)+");");
for(const [n,status] of [[30,'cancelled'],[31,'playing'],[32,'finished']]){match(n,'sixty_one','{}',status);run("insert into public.sixty_one_visits values("+n+","+id(n)+");insert into public.sixty_one_match_state(match_id,undo_snapshot,undo_visit_id,undo_player_id) values("+id(n)+",'"+JSON.stringify({match_status:'playing',match_player1_score:61,match_player2_score:61,match_player1_legs:0,match_player2_legs:0,match_current_leg:1})+"',"+n+","+A+");")}
bad(()=>undo(A,30),/cannot be undone/);bad(()=>undo(X,31),/not a player/);bad(()=>undo(B,31),/Nothing to undo/);good(()=>undo(A,31));good(()=>undo(A,32));assert.equal(run("select status from public.matches where id="+id(32)),'playing');
assert.equal(run("select count(*) from public.sixty_one_visits where match_id="+id(30)),'1');
assert.equal(run("select has_function_privilege('anon','public.correct_x01_throw(bigint,integer)','EXECUTE') or has_function_privilege('anon','public.correct_throw_to_checkout(bigint,integer,integer)','EXECUTE') or has_function_privilege('anon','public.undo_sixty_one_last(uuid)','EXECUTE')"),'f');
console.log(JSON.stringify({accepted,rejected,validCheckout:true,chicagoLocked:true,sixtyOneFinalUndoPreserved:true,anonDenied:true}));
