const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const sql=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
function run(s){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim().split('\n').at(-1)}
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000003';
const miss=Array.from({length:3},()=>({n:0,mult:0})),d=(n,mult=1)=>({n,mult});
let passed=0,rejected=0;
function seed(id,mode,round,before=13){
 run("insert into matches(id,player1_id,player2_id,game_variant,game_config,status,current_leg,player1_score,player2_score,turn_player_id,match_starter_id) values ('"+id+"','"+a+"','"+b+"','half_it',"+sql({half_it_mode:mode})+",'playing',1,7,99,'"+b+"','"+a+"'); insert into half_it_match_state(match_id,exact_target,exact_options) values ('"+id+"',41,array[41,65,121]);");
 const darts=miss;
 const row=run("insert into half_it_visits(match_id,player_id,leg_no,round_no,darts,success,round_points,score_before,score_after,exact_target) values ('"+id+"','"+a+"',1,"+round+","+sql(darts)+",false,0,"+before+","+(mode==='standard'?Math.ceil(before/2):Math.floor(before/2))+","+(mode==='dartcounter'&&round===8?'41':mode==='standard'&&round===9?'41':'null')+") returning id;");
 return Number(row);
}
function call(id,payload,expected=miss,actor=a,role='authenticated'){return run("select set_config('test.actor','"+actor+"',false);set role "+role+";select public.correct_half_it_visit("+id+","+sql(expected)+","+sql(payload)+");")}
function good(id,payload,score,points,success,expected=miss){assert.equal(JSON.parse(call(id,payload,expected)).score_after,score);const x=JSON.parse(run("select jsonb_build_object('round_points',round_points,'success',success) from half_it_visits where id="+id));assert.deepEqual(x,{round_points:points,success});passed++}
function bad(fn){try{fn()}catch(e){assert.match(String(e.stderr),/HALF_CORRECTION|Invalid dart|multiplier|Bull must|permission denied|Number darts/);rejected++;return}throw Error('Invalid correction accepted')}
let i=10;function uuid(){return '10000000-0000-0000-0000-'+String(i++).padStart(12,'0')}
for(const mode of ['standard','dartcounter']){
 const cases=mode==='standard'?[
 [1,[d(13,3),d(13),d(0,0)],52],[2,[d(14,2),d(14),d(0,0)],42],[3,[d(25,2),d(20,2),d(20)],90],[4,[d(15),d(15),d(15)],45],[5,[d(16),d(16),d(16)],48],[6,[d(20,3),d(19,3),d(1)],117],[7,[d(17),d(17),d(17)],51],[8,[d(18),d(18),d(18)],54],[9,[d(20),d(20),d(1)],41],[10,[d(19),d(19),d(19)],57],[11,[d(20),d(20),d(20)],60],[12,[d(25),d(25,2),d(0,0)],75]
 ]:[
 [1,[d(20,3),d(20),d(0,0)],80],[2,[d(25,2),d(20,2),d(20)],90],[3,[d(19),d(19),d(19)],57],[4,[d(20,3),d(19,3),d(1)],117],[5,[d(18),d(18),d(18)],54],[6,[d(20),d(1),d(20,3)],81],[7,[d(17),d(17),d(17)],51],[8,[{...d(20),exact_target:41},d(20),d(1)],41],[9,[d(16),d(16),d(16)],48],[10,[d(20),d(20),d(20)],60],[11,[d(15),d(15),d(15)],45],[12,[d(25),d(25,2),d(0,0)],75]
 ];
 for(const [round,payload,points] of cases){
  const id=seed(uuid(),mode,round);good(id,payload,13+points,points,true);
  const id2=seed(uuid(),mode,round);good(id2,miss,mode==='standard'?7:6,0,false);
 }
 const mid=uuid(),id=seed(mid,mode,1);
 run("insert into half_it_visits(match_id,player_id,leg_no,round_no,darts,success,round_points,score_before,score_after) values ('"+mid+"','"+a+"',1,2,"+sql(miss)+",false,0,7,3),('"+mid+"','"+a+"',1,3,"+sql(miss)+",true,20,3,23),('"+mid+"','"+b+"',1,1,"+sql(miss)+",false,0,99,50);");
 const target=mode==='standard'?13:20,payload=[d(target),d(0,0),d(0,0)],first=13+target,after=mode==='standard'?Math.ceil(first/2):Math.floor(first/2);
 good(id,payload,after+20,target,true);
 const result=JSON.parse(run("select jsonb_build_object('p1',player1_score,'p2',player2_score,'turn',turn_player_id,'leg',current_leg) from matches where id='"+mid+"'"));
 assert.deepEqual(result,{p1:after+20,p2:99,turn:b,leg:1});
 assert.equal(Number(run("select score_before from half_it_visits where match_id='"+mid+"' and player_id='"+a+"' and round_no=3")),after);
 bad(()=>call(id,miss,miss)); // stale expected
 bad(()=>call(id,miss,payload,b));bad(()=>call(id,miss,payload,outsider));bad(()=>call(id,miss,payload,a,'anon'));
 bad(()=>call(id,[d(25,3),d(0,0),d(0,0)],payload));bad(()=>call(id,[d(1),d(2)],payload));
 run("insert into half_it_visits(match_id,player_id,leg_no,round_no,darts,success,round_points,score_before,score_after) values ('"+mid+"','"+a+"',1,4,"+sql(miss)+",false,0,0,0);");
 bad(()=>call(id,miss,payload));
 run("update matches set current_leg=2 where id='"+mid+"'");bad(()=>call(id,miss,payload));
 run("update matches set current_leg=1,status='finished' where id='"+mid+"'");bad(()=>call(id,miss,payload));
}
const ex=seed(uuid(),'dartcounter',8);
good(ex,[{...d(20,3),exact_target:121},d(20,3),d(1)],134,121,true);
const ex2=seed(uuid(),'dartcounter',8);
bad(()=>call(ex2,[{...d(20),exact_target:42},d(20),d(2)]));
console.log(JSON.stringify({passed,rejected,rounds:24,opponentPreserved:true,turnPreserved:true,activeLegOnly:true}));
