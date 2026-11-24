const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const id=n=>"'00000000-0000-0000-0000-"+String(n).padStart(12,'0')+"'";
const A=id(1),B=id(2),C=id(3);
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const as=sql=>run('set role authenticated;'+sql);
const json=sql=>JSON.parse(as('select coalesce(jsonb_agg(to_jsonb(r)),\'[]\') from ('+sql+') r;'));
let cases=0;
run("insert into public.profiles(id,username) values("+A+",'A'),("+B+",'B'),("+C+",'C');");
function match(n,opts={}){
 const {game=501,variant='x01',status='finished',warmup=false,deleted=false,chicago=false,winner=A}=opts;
 run("insert into public.matches(id,player1_id,player2_id,status,game,game_variant,game_config,is_warmup,deleted_at,winner_id,player1_legs,player2_legs) values("+id(n)+","+A+","+B+",'"+status+"',"+game+",'"+variant+"','"+JSON.stringify({chicago})+"',"+warmup+","+(deleted?'now()':'null')+","+winner+","+(winner===A?1:0)+","+(winner===B?1:0)+");");
}
function tournament(n,m,opts={}){
 const {status='finished',enabled=true,fixtureStatus='finished',game=501,variant='x01',stage='group',cupGame=501,cupVariant='x01',p1=A,p2=B}=opts;
 run("insert into public.tournaments(id,status,stats_enabled,game,game_variant,cup_game,cup_game_variant,finished_at) values("+id(n)+",'"+status+"',"+enabled+","+game+",'"+variant+"',"+cupGame+",'"+cupVariant+"',now());insert into public.tournament_matches values("+id(n+1000)+","+id(n)+","+id(m)+","+p1+","+p2+",'"+fixtureStatus+"','"+stage+"',"+A+",1,0);");
}
function visits(m,arr,p=A){run("insert into public.match_throws(match_id,player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,created_at) values "+arr.map((x,i)=>"("+id(m)+","+p+",1,1,"+(i+1)+","+x[0]+","+(x[1]||3)+","+(x[2]||false)+",now()-interval '"+i+" seconds')").join(',')+";")}
match(10);visits(10,[[180],[180],[141,3,true]]);
match(11,{winner:B});visits(11,[[60],[100],[140],[41]]);
match(12);tournament(112,12,{stage:'cup',game:170});visits(12,[[100],[100],[100],[100],[101,2,true]]);
// Every excluded match carries visits that would measurably distort the stats.
const exclusions=[
 [20,{game:170},null],[21,{game:301},null],[22,{game:1001},null],[23,{game:2001},null],[24,{variant:'cricket'},null],[25,{variant:'pentathlon'},null],[26,{variant:'jdc'},null],[27,{variant:'half_it'},null],[28,{variant:'sixty_one'},null],[29,{chicago:true},null],[30,{warmup:true},null],[31,{deleted:true},null],[32,{status:'cancelled'},null],[33,{status:'playing'},null],
 [34,{}, {status:'cancelled'}],[35,{}, {enabled:false}],[36,{}, {fixtureStatus:'wo'}],[37,{}, {game:170}],[38,{}, {variant:'chicago'}],[39,{}, {stage:'cup',cupGame:170}],[40,{}, {stage:'cup',cupVariant:'chicago'}],[41,{}, {p1:B,p2:A}]
];
for(const [m,o,t] of exclusions){match(m,o);if(t)tournament(m+200,m,t);visits(m,[[180],[180],[141,3,true]]);cases++}
visits(10,[[180],[180],[141,3,true]],C);
const career=json("select * from public.get_player_career_stats("+A+")")[0];
const directory=json("select * from public.get_player_directory_stats('',500)").find(r=>r.user_id===A.slice(1,-1));
const form=json("select * from public.get_form_stats(5)").find(r=>r.player_id===A.slice(1,-1));
assert.equal(career.total_matches,3);assert.equal(career.wins,2);assert.equal(career.losses,1);
assert.equal(career.total_score,1343);assert.equal(career.total_darts,35);
assert.equal(Number(career.three_dart_avg),115.11);
assert.equal(Number(career.first9_avg),122.33);
assert.equal(Number(career.best_match_avg),167);
assert.equal(career.fastest_leg,9);assert.equal(career.highest_checkout,141);
assert.equal(career.c180,2);assert.equal(career.c100,6);assert.equal(career.c140,2);
for(const [dk,ck] of [['matches','total_matches'],['wins','wins'],['x01_avg','three_dart_avg'],['first9_avg','first9_avg'],['highest_checkout','highest_checkout'],['fastest_leg','fastest_leg'],['c100','c100'],['c140','c140'],['c180','c180']])assert.equal(Number(directory[dk]),Number(career[ck]),dk+' parity');
assert.equal(form.matches_count,1);assert.equal(form.tournaments_count,1);assert.equal(Number(form.form_avg),107.36);assert.equal(Number(form.first9_avg),100);assert.equal(form.fastest_leg,14);assert.equal(form.highest_checkout,101);
const foreign=json("select * from public.get_player_directory_stats('',500)").find(r=>r.user_id===C.slice(1,-1));
assert.equal(Number(foreign.x01_avg),0);
assert.equal(json("select * from public.get_player_career_stats("+C+")")[0].total_matches,0);
assert.throws(()=>as("update public.matches set winner_id="+B+" where id="+id(10)),/permission denied/);
assert.throws(()=>as("update public.match_throws set score=180"),/permission denied/);
assert.equal(run("select has_function_privilege('anon','public.get_player_career_stats(uuid)','EXECUTE')"),'f');
// A completed match in an ongoing official tournament still counts for career,
// while form continues to use only completed tournaments.
match(50);tournament(150,50,{status:'groups'});visits(50,[[180],[180],[141,3,true]]);
assert.equal(json("select * from public.get_player_career_stats("+A+")")[0].total_matches,4);
assert.equal(json("select * from public.get_form_stats(5)").find(r=>r.player_id===A.slice(1,-1)).matches_count,1);
console.log(JSON.stringify({excludedCases:cases,careerDirectoryParity:true,first9:true,checkout:true,fastestLeg:true,formCompletedOnly:true,ordinaryAndCupIncluded:true,foreignThrowExcluded:true,writeAccessDenied:true}));
