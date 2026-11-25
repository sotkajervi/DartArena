const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('sixty-one-shared-start.js','utf8');
function fixture(){
 const cls=()=>{const set=new Set();return{toggle(k,v){v?set.add(k):set.delete(k)},contains:k=>set.has(k)}};
 const b={classList:cls()},note={classList:cls()},body={classList:cls()},calls=[];let ctx;
 const now=Date.now(),started=new Date(now-1000).toISOString();
 ctx={b,note,starting:false,m:{status:'playing',turn_player_id:'a',player1_id:'a',player2_id:'b'},state:{game_started_at:null,leg_duration_seconds:600},sharedEnd:()=>new Date(ctx.state.game_started_at).getTime()+600000,profile:{id:'a'},document:{body},render(){calls.push('render')},db:{rpc:async(name,args)=>{calls.push([name,args.p_match_id]);return{error:null}}},matchId:'test',refreshGame:async()=>{ctx.state.game_started_at=started;ctx.render()},alert:()=>calls.push('alert')};
 const i=src.indexOf(' function syncStartUI(){'),j=src.indexOf(' let tries=0;',i);
 a.ok(i>=0&&j>i);vm.createContext(ctx);vm.runInContext(src.slice(i,j),ctx);return{ctx,b,note,body,calls,started};
}
test('Other PC receives authoritative start through existing match render, no extra subscription needed',()=>{
 const {ctx,b,note,body,started}=fixture();
 a.ok(body.classList.contains('sixty-one-not-started'));a.equal(b.disabled,false);a.equal(b.classList.contains('hidden'),false);
 ctx.state.game_started_at=started;ctx.render();
 a.equal(body.classList.contains('sixty-one-not-started'),false);a.equal(b.classList.contains('hidden'),true);a.equal(note.textContent,'Felles servertid aktiv');
 ctx.state.game_started_at=null;ctx.render();a.equal(b.disabled,false);a.equal(b.classList.contains('hidden'),false);
 ctx.m.status='finished';ctx.render();a.equal(b.disabled,true);a.equal(b.classList.contains('hidden'),true);
});
test('Starting locally uses the existing client, refreshes game, and does not submit a second start',async()=>{
 const {ctx,b,calls,body}=fixture();
 await b.onclick();await b.onclick();
 a.equal(calls.filter(x=>Array.isArray(x)).length,1);a.deepEqual(calls.find(x=>Array.isArray(x)),['start_sixty_one_match','test']);
 a.equal(body.classList.contains('sixty-one-not-started'),false);
 a.doesNotMatch(src,/createClient\(|\.channel\(|sharedState/);
 a.match(src,/const baseRender=render/);
});

test('Expired clock persists with correct remaining attempt, including opponent and reset',()=>{
 const {ctx,note}=fixture();
 ctx.state.game_started_at=new Date(Date.now()-601000).toISOString();ctx.state.player1_attempts=2;ctx.state.player2_attempts=3;ctx.render();
 a.equal(note.textContent,'Tiden ute · ditt siste forsøk');a.ok(note.classList.contains('time-up'));
 ctx.profile.id='b';ctx.render();a.equal(note.textContent,'Tiden ute · motstanderens siste forsøk');
 ctx.state.player1_attempts=3;ctx.render();a.equal(note.textContent,'Tiden ute · avgjør leg…');
 ctx.state.sudden_death=true;ctx.state.sudden_death_target=71;ctx.render();a.match(note.textContent,/SUDDEN DEATH/);a.equal(note.classList.contains('time-up'),false);
 ctx.state.sudden_death=false;ctx.state.game_started_at=null;ctx.render();a.equal(note.textContent,'Begge klare? Start tiden');
});