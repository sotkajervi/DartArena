const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8'),src=read('shared-results.js');
const extract=(x,y)=>{const start=src.indexOf(x),end=src.indexOf(y,start);a.ok(start>=0&&end>start);return src.slice(start,end)};
const code=extract('  function displayOrder(m)','  function orderedScore(')+extract('  function cumulativeSummary(','  function hideResult(')+extract('  async function buildHalfIt(m)','  async function buildSixtyOne(')+extract('  function summaryHtml(','  // Result stays visible');
for(const mode of ['standard','dartcounter'])test(mode+' reports each leg final score in winner-first order',async()=>{
 const data=[{player_id:'a',leg_no:1,round_no:11,score_after:90,success:true},{player_id:'a',leg_no:1,round_no:12,score_after:100,success:true},{player_id:'b',leg_no:1,round_no:12,score_after:150,success:true},{player_id:'a',leg_no:2,round_no:12,score_after:120,success:true},{player_id:'b',leg_no:2,round_no:12,score_after:190,success:true}];
 const context={num:v=>Number(v||0),sortTime:()=>0,pct:()=>'',fillStats:x=>x,esc:String,resultDb:{from:()=>({select:()=>({eq:async()=>({data})})})}};
 vm.createContext(context);vm.runInContext(code,context);
 const m={id:'match',player1_id:'a',player2_id:'b',winner_id:'b',status:'finished',game_config:{half_it_mode:mode}};
 const result=await context.buildHalfIt(m);
 a.equal(result.summary[0].score,'1 – 0');a.equal(result.summary[1].score,'2 – 0');
 a.deepEqual(JSON.parse(JSON.stringify(result.summary.map(x=>x.metric.values))),[{a:100,b:150},{a:120,b:190}]);
 const html=context.summaryHtml(result.summary,{a:'A',b:'B'},m);
 a.match(html,/SLUTTSCORE<\/span><b>B: 150<\/b><i>•<\/i><b>A: 100/);a.match(html,/B: 190<\/b><i>•<\/i><b>A: 120/);
});
test('Half-It loads updated shared renderer',()=>a.match(read('half-it.html'),/shared-results\.js\?v=20261125-half-leg-scores1/));
