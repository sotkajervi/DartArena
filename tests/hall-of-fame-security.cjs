const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const id=n=>"'00000000-0000-0000-0000-"+String(n).padStart(12,'0')+"'";
const A=id(1),B=id(2),C=id(3);
function run(sql){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
function json(sql){return JSON.parse(run("set test.actor="+A+";set role authenticated;select coalesce(jsonb_agg(to_jsonb(r)),'[]') from ("+sql+") r;"))}
run("insert into public.profiles(id,username) values("+A+",'A'),("+B+",'B'),("+C+",'C');");
function match(n,o={}){const {game=501,variant='x01',status='finished',warmup=false,deleted=false,chicago=false}=o;run("insert into public.matches(id,player1_id,player2_id,status,game,game_variant,game_config,is_warmup,deleted_at,winner_id,player1_legs,player2_legs) values("+id(n)+","+A+","+B+",'"+status+"',"+game+",'"+variant+"','"+JSON.stringify({chicago})+"',"+warmup+","+(deleted?'now()':'null')+","+A+",1,0);")}
function tournament(n,m,o={}){const {status='finished',enabled=true,fixtureStatus='finished',game=501,variant='x01',stage='group',cupGame=501,cupVariant='x01',p1=A,p2=B}=o;run("insert into public.tournaments(id,status,stats_enabled,game,game_variant,cup_game,cup_game_variant,finished_at) values("+id(n)+",'"+status+"',"+enabled+","+game+",'"+variant+"',"+cupGame+",'"+cupVariant+"',now());insert into public.tournament_matches values("+id(n+1000)+","+id(n)+","+id(m)+","+p1+","+p2+",'"+fixtureStatus+"','"+stage+"',"+A+",1,0);")}
function visits(n,arr,player=A){run("insert into public.match_throws(match_id,player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout) values "+arr.map((x,i)=>"("+id(n)+","+player+",1,1,"+(i+1)+","+x[0]+","+(x[1]||3)+","+(x[2]||false)+")").join(',')+";")}
match(10);visits(10,[[180],[140],[100],[81,2,true]]);
match(11);tournament(111,11,{stage:'cup',game:170});visits(11,[[140],[140],[140],[81,2,true]]);
const excluded=[[20,{game:170},null],[21,{game:301},null],[22,{game:1001},null],[23,{variant:'cricket'},null],[24,{variant:'pentathlon'},null],[25,{chicago:true},null],[26,{warmup:true},null],[27,{deleted:true},null],[28,{status:'cancelled'},null],[29,{status:'playing'},null],[30,{}, {status:'cancelled'}],[31,{}, {enabled:false}],[32,{}, {fixtureStatus:'wo'}],[33,{}, {game:170}],[34,{}, {variant:'chicago'}],[35,{}, {stage:'cup',cupGame:170}],[36,{}, {stage:'cup',cupVariant:'chicago'}],[37,{}, {p1:B,p2:A}]];
for(const [n,o,t] of excluded){match(n,o);if(t)tournament(n+200,n,t);visits(n,[[180],[180],[141,3,true]])}
visits(10,[[180],[180],[141,3,true]],C);
for(const [metric,expected] of [['180',1],['140',4],['100',1],['checkout',81],['fast_leg',11],['avg',136.64]]){const rows=json("select * from public.get_hall_of_fame('501','"+metric+"')");assert.equal(rows.length,1,metric);assert.equal(rows[0].user_id,A.slice(1,-1));assert.equal(Number(rows[0].record_value),expected,metric);assert.equal(rows[0].is_mine,true)}
const legacy=json("select * from public.get_player_directory('',200)"),current=json("select * from public.get_player_directory_stats('',200)");
assert.deepEqual(legacy,current.map(({user_id,username,registered_at,matches,wins,win_pct,x01_avg,c180})=>({user_id,username,registered_at,matches,wins,win_pct,x01_avg,c180})));
match(50,{variant:'half_it'});run("update public.matches set game_config='{\"half_it_mode\":\"standard\"}' where id="+id(50)+";insert into public.half_it_visits(match_id,player_id,leg_no,round_no,score_after) values("+id(50)+","+A+",1,12,777);");
assert.equal(Number(json("select * from public.get_hall_of_fame('half_standard','score')")[0].record_value),777);
assert.equal(run("select has_function_privilege('anon','public.get_hall_of_fame(text,text)','EXECUTE') or has_function_privilege('anon','public.get_player_directory(text,integer)','EXECUTE')"),'f');
console.log(JSON.stringify({excluded:excluded.length,metrics:6,legacyParity:true,halfItUnchanged:true,anonDenied:true}));
