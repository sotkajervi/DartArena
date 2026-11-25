const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const S=require('../heatmap-storage.js');
const point=(i)=>({u:.01,v:-.7,time:new Date(1764000000000+i).toISOString(),tipDetected:true,quality:'private discarded'});
test('Storage merges duplicates, bounds coordinates, strips non-coordinate fields, caps per game',()=>{
 const p=point(1);a.deepEqual(S.merge([p],[p,{...p,u:9}]),[{u:.01,v:-.7,time:p.time,tipDetected:true}]);
 a.equal(S.clean(Array.from({length:650},(_,i)=>point(i))).length,600);
});
test('Writes only local player snapshot, skips unchanged points, retries after network failure',async()=>{
 let calls=[],rows=[point(1)],fail=true;const db={async rpc(name,args){calls.push({name,args});return{error:fail?new Error('offline'):null}}};
 const flush=S.writer(db,'match-a',()=>rows);await a.rejects(flush);fail=false;await flush();await flush();rows.push(point(2));await flush();a.equal(calls.length,3);a.equal(calls[2].name,'save_match_heatmap');a.deepEqual(Object.keys(calls[2].args).sort(),['p_match_id','p_points']);a.equal(calls[2].args.p_points.length,2);
});
test('Personal density counts more than 600 darts and does not distort relative weights',()=>{
 const rows=[{points:Array.from({length:600},(_,i)=>point(i))},{points:Array.from({length:500},(_,i)=>point(i+1000))}];const result=S.aggregate(rows);a.equal(result.count,1100);a.equal(result.points.reduce((n,p)=>n+p.weight,0),1100);a.equal(result.points.length,1);
});
test('Tournament and normal history use the real live match ID and same read-only viewer',()=>{
 for(const p of ['match-stats.html','tournament-match-stats.html']){const html=fs.readFileSync(p,'utf8');a.match(html,/heatmap-storage\.js\?v=20261125-persistent1/);a.ok(html.indexOf('premium-heatmap-view.js')<html.indexOf('premium-match-stats.js'))}
 const c=fs.readFileSync('online-heatmap-result.js','utf8');a.doesNotMatch(c,/\.has\('tournamentMatch'\)/);a.match(c,/S.writer\(db,matchId,\(\)=>data\[userId\]\)/);a.match(c,/setInterval\(saveCloud,10000\)/);a.doesNotMatch(c,/getUserMedia|\.rpc\(|\.insert\(|\.update\(/);
 a.match(fs.readFileSync('premium-match-stats.js','utf8'),/DartArenaPremiumHeatmap\?\.mount\(match.id,db\)/);
 const sql=fs.readFileSync('supabase-match-heatmaps.sql','utf8');a.match(sql,/enable row level security/);a.match(sql,/security invoker/);a.match(sql,/values\(p_match_id,auth.uid\(\),p_points\)/);a.doesNotMatch(sql,/security definer/i);
});
