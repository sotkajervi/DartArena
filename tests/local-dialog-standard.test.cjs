const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('all four local dialog call sites use the shared async dialog and pages load it first',()=>{
 for(const p of ['pentathlon-2p.js','bot-match.js','scoringarena-history.js','practice-cloud.js']){
  const s=read(p);a.doesNotMatch(s,/(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/,p);a.match(s,/await window\.DartArenaDialog\.confirm\(/,p);a.match(s,/getLanguage/);
 }
 for(const [p,j] of Object.entries({'pentathlon-2p.html':'pentathlon-2p.js','bot-match.html':'bot-match.js','scoringarena.html':'scoringarena-history.js','local-head-to-head.html':'practice-cloud.js','ai-rival-501.html':'practice-cloud.js'})){
  const s=read(p);a.ok(s.indexOf('dartarena-dialog.js')>=0&&s.indexOf('dartarena-dialog.js')<s.indexOf(j+'?v=20261126-local-dialog1'),p);
 }
});
test('Pentathlon cancellation preserves state and history, acceptance resets once',async()=>{
 const s=read('pentathlon-2p.js');const from=s.indexOf('const dialogText='),to=s.indexOf('function nextStage(){',from);
 let accepts,archived=0,stops=0,clears=0;
 const el={hidden:false,scrollIntoView(){}},env={window:{DartArenaI18n:{getLanguage:()=>'en'},DartArenaDialog:{confirm:async()=>accepts,alert:async()=>{}}},state:{status:'finished'},archiveLocal:()=>archived++,archiveWarning:false,stopRival:()=>stops++,rivalProfile:null,ghostProfile:null,shanghaiQueue:[],clockQueue:[],halfQueue:[],document:{body:{classList:{remove(){}}}},localStorage:{removeItem(){clears++}},activeStore:()=>'',rivalMode:false,RIVAL_ROWS:'r',SHANGHAI_QUEUE_KEY:'s',CLOCK_QUEUE_KEY:'c',HALF_QUEUE_KEY:'h',modeSuffix:()=>'',$:()=>el,modeChanged(){}};
 const run=vm.runInNewContext(s.slice(from,to)+';reset',env);
 accepts=false;await run();a.equal(archived,0);a.equal(stops,0);a.equal(clears,0);a.equal(env.state.status,'finished');
 accepts=true;await run();a.equal(archived,1);a.equal(stops,1);a.equal(env.state,null);a.ok(clears>0);
});
test('Pentathlon scoring keys do not intercept shared modal input',()=>{const s=read('pentathlon-2p.js');for(const m of s.matchAll(/document\.addEventListener\('keydown',event=>\{([^\n]*\n?[^\n]*)/g))a.match(m[1],/resetPending\|\|window\.DartArenaDialog\.isOpen\(\)/);});
test('cloud resume validates player reference before overwriting local state',()=>{const s=read('practice-cloud.js');const start=s.indexOf('resume.onclick=async');const part=s.slice(start,s.indexOf('div.append(resume)',start));a.ok(part.indexOf('!selected')<part.indexOf('localStorage.setItem(key'));a.ok(part.indexOf('await window.DartArenaDialog.confirm')<part.indexOf('localStorage.setItem(key'));});
