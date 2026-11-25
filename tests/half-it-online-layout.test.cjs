const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Half-It uses existing X01 TV layout and both engines keep the same DOM identifiers',()=>{
 const h=read('half-it.html');
 for(const id of ['videoGrid','localVideo','remoteVideo','halfP1','halfP2','halfName1','halfName2','halfScore1','halfScore2','halfRound1','halfRound2','halfRoundLabel','halfTarget','halfHelp','halfNextTarget','halfEntry','halfDarts','halfPad','halfMissBtn','halfUndoBtn','halfSubmitBtn','halfHistoryBody','historyName1','historyName2','turnText','matchMessage','cameraBtn','exactStatusRow','exactTarget'])a.equal((h.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 a.match(h,/half-grid match-grid/);a.match(h,/half-scoreboard match-players/);
 a.match(h,/score-entry half-dock-content/);a.match(h,/opponent-focus\.js\?v=20261026-owncam-pip1/);a.match(h,/match-own-turn\.css\?v=20261104-x01-unified-frame1/);
 a.match(read('half-it-bootstrap.js'),/half-it-standard\.js/);a.match(read('half-it-bootstrap.js'),/half-it\.js/);
});
test('Result list preserves the authoritative round table, and the dock is measured without new scoring handlers',()=>{
 const h=read('half-it.html'),s=read('half-it-online-layout.js'),c=read('half-it-online-layout.css');
 a.match(h,/<dialog id="halfResultsDialog"[\s\S]*id="halfHistoryBody"[\s\S]*<\/dialog>/);
 a.match(s,/ResizeObserver\(measure\)/);a.match(s,/dialog\.open&&event\.key!=='Escape'/);
 a.doesNotMatch(s,/\.rpc\(|\.from\(|getUserMedia|srcObject|submitRound/);
 a.match(c,/half-actions\.hidden\{display:none!important\}/);
 a.match(c,/--da-x01-input-reserve:var\(--half-dock-height/);
});
