const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8'),src=read('half-it-leg-break.js'),c={};vm.createContext(c);vm.runInContext(src.slice(0,src.indexOf('(()=>{')),c);
const plain=x=>JSON.parse(JSON.stringify(x));
const match={status:'playing',current_leg:1,player1_id:'a',player2_id:'b',player1_legs:0,player2_legs:0,match_starter_id:'a'};
const rows=[{player_id:'a',leg_no:1,round_no:11,score_after:300},{player_id:'a',leg_no:1,round_no:12,score_after:100},{player_id:'b',leg_no:1,round_no:12,score_after:150}];
test('Live transition opens once with final scores, standing and starter; no replay on reload',()=>{
 const t=c.halfItLegBreakTracker(),next={...match,current_leg:2,player2_legs:1,match_starter_id:'b'};
 a.deepEqual(plain(t(match,[])),{});
 a.deepEqual(plain(t(next,rows.slice(0,2))),{waiting:true});
 a.deepEqual(plain(t(next,rows)),{data:{leg:1,ids:['a','b'],scores:[100,150],winnerId:'b',legs:[0,1],nextLeg:2,starterId:'b'}});
 a.deepEqual(plain(t(next,rows)),{});a.deepEqual(plain(t(match,rows)),{});
 a.deepEqual(plain(c.halfItLegBreakTracker()(next,rows)),{});
 a.deepEqual(plain(t({...next,status:'finished'},rows)),{close:true});
});
test('Tied legs retain the same match standing and show no winner',()=>{
 const t=c.halfItLegBreakTracker();t(match,[]);const data=t({...match,current_leg:2},rows.map(r=>({...r,score_after:100}))).data;a.equal(data.winnerId,null);a.deepEqual(plain(data.legs),[0,0]);
});
test('Both online variants load the same popup and capture Enter before game shortcuts',()=>{
 const b=read('half-it-bootstrap.js');a.equal((b.match(/half-it-leg-break\.js\?v=20261125-leg-popup1/g)||[]).length,2);
 a.match(src,/if\(e\.key==='Enter'\)\{e\.preventDefault\(\);if\(!e\.repeat\)close\(\)\}/);
 a.match(src,/e\.stopImmediatePropagation\(\);\s*\},true\)/);
 a.match(read('half-it.html'),/dartarena-dialog\.css/);
});
