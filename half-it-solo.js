const $=id=>document.getElementById(id);
const BOARD=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const DARTCOUNTER_ROUNDS=[
 {type:'number',target:20,label:'20',help:'Tre piler på 20. Single, double og treble teller normal verdi.'},
 {type:'double',label:'Double',help:'Tre piler. Alle doubler teller sin normale verdi.'},
 {type:'number',target:19,label:'19',help:'Tre piler på 19. Single, double og treble teller normal verdi.'},
 {type:'treble',label:'Treble',help:'Tre piler. Alle trebler teller sin normale verdi.'},
 {type:'number',target:18,label:'18',help:'Tre piler på 18. Single, double og treble teller normal verdi.'},
 {type:'different',label:'3 forskjellige farger',help:'Alle tre pilene må lande i tre forskjellige dartboard-farger. Da teller summen av alle tre.'},
 {type:'number',target:17,label:'17',help:'Tre piler på 17. Single, double og treble teller normal verdi.'},
 {type:'exact',label:'Eksakt score',help:'Velg ett av de tre måltallene og treff nøyaktig totalscore med tre piler.'},
 {type:'number',target:16,label:'16',help:'Tre piler på 16. Single, double og treble teller normal verdi.'},
 {type:'same',label:'Samme farge',help:'Alle tre pilene må lande i samme dartboard-farge. Da teller summen av alle tre.'},
 {type:'number',target:15,label:'15',help:'Tre piler på 15. Single, double og treble teller normal verdi.'},
 {type:'bull',label:'Bull',help:'Tre piler på bull. Outer bull gir 25 og bullseye 50.'}
];
const STANDARD_ROUNDS=[
 {type:'number',target:13,label:'13',help:'Tre piler på 13. Single, double og treble på 13 teller.'},
 {type:'number',target:14,label:'14',help:'Tre piler på 14. Single, double og treble på 14 teller.'},
 {type:'double',label:'Dobbel',help:'Tre piler. Alle doubler teller sin normale verdi.'},
 {type:'number',target:15,label:'15',help:'Tre piler på 15. Single, double og treble på 15 teller.'},
 {type:'number',target:16,label:'16',help:'Tre piler på 16. Single, double og treble på 16 teller.'},
 {type:'treble',label:'Trippel',help:'Tre piler. Alle tripler teller sin normale verdi.'},
 {type:'number',target:17,label:'17',help:'Tre piler på 17. Single, double og treble på 17 teller.'},
 {type:'number',target:18,label:'18',help:'Tre piler på 18. Single, double og treble på 18 teller.'},
 {type:'exact41',target:41,label:'41',help:'Alle tre pilene må være tellende og summen må bli nøyaktig 41.'},
 {type:'number',target:19,label:'19',help:'Tre piler på 19. Single, double og treble på 19 teller.'},
 {type:'number',target:20,label:'20',help:'Tre piler på 20. Single, double og treble på 20 teller.'},
 {type:'bull',label:'Bull',help:'Tre piler på bull. Outer bull gir 25 og bullseye 50.'}
];
const params=new URLSearchParams(location.search);
let mode=params.get('mode')==='standard'?'standard':'dartcounter';
let rounds=mode==='standard'?STANDARD_ROUNDS:DARTCOUNTER_ROUNDS;
let roundIndex=0,score=0,selectedDarts=[],selectedMult=1,history=[],exactOptions=[],exactTarget=null,finished=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dartValue=d=>d.n===25?25*d.mult:d.n*d.mult;
function dartLabel(d){if(!d||d.n===0)return'MISS';if(d.n===25)return d.mult===1?'25':'50';return`${d.mult===1?'S':d.mult===2?'D':'T'}${d.n}`}
function dartColor(d){if(!d||d.n===0)return'miss';if(d.n===25)return d.mult===1?'green':'red';const idx=BOARD.indexOf(d.n);if(idx<0)return'?';if(d.mult===1)return idx%2===0?'black':'white';return idx%2===0?'red':'green'}
function allDartValues(){const vals=new Set([0,25,50]);for(let n=1;n<=20;n++){vals.add(n);vals.add(n*2);vals.add(n*3)}return[...vals]}
const REACHABLE=(()=>{const vals=allDartValues(),s=new Set();for(const a of vals)for(const b of vals)for(const c of vals){const t=a+b+c;if(t>=2&&t<=180)s.add(t)}return[...s].sort((a,b)=>a-b)})();
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function generateExactOptions(){const low=REACHABLE.filter(n=>n>=41&&n<=120),high=REACHABLE.filter(n=>n>=121&&n<=170);let a=pick(low),b=pick(low);while(b===a)b=pick(low);let c=Math.random()<.8?pick(high):pick(low);while(c===a||c===b)c=Math.random()<.8?pick(high):pick(low);return[a,b,c]}
function currentRound(){return rounds[roundIndex]}
function setModeText(){const dc=mode==='dartcounter';$('soloTitle').textContent=dc?'Half-It (DartCounter)':'Half-It (Standard)';$('soloVariantLabel').textContent=dc?'HALF-IT • DARTCOUNTER':'HALF-IT • STANDARD';document.title=`DartArena • ${dc?'Half-It DartCounter':'Half-It Standard'}`}
function addDart(n,mult){if(finished||selectedDarts.length>=3)return;const r=currentRound();if(r.type==='exact'&&!exactTarget&&Number(n)!==0){$('soloMessage').textContent='Velg ett av de tre måltallene først.';return}if(n===25&&mult===3)return;selectedDarts.push({n:Number(n),mult:Number(mult)});$('soloMessage').textContent='';renderEntry();renderExactChoices()}
function buildPad(){const host=$('soloPad'),r=currentRound(),enabled=!finished&&selectedDarts.length<3;if(!host||!r)return;
 if(r.type==='number')host.innerHTML=`<div class="half-quick"><button class="outline half-hit" data-n="${r.target}" data-mult="1">S${r.target}</button><button class="outline half-hit" data-n="${r.target}" data-mult="2">D${r.target}</button><button class="outline half-hit" data-n="${r.target}" data-mult="3">T${r.target}</button></div>`;
 else if(r.type==='bull')host.innerHTML='<div class="half-quick"><button class="outline half-hit" data-n="25" data-mult="1">25</button><button class="outline half-hit" data-n="25" data-mult="2">50</button></div>';
 else if(r.type==='double'||r.type==='treble'){
  const mult=r.type==='double'?2:3,nums=Array.from({length:20},(_,i)=>i+1),bull=r.type==='double'?'<button class="outline half-hit" data-n="25" data-mult="2">DB</button>':'';
  host.innerHTML=`<div class="half-number-grid">${nums.map(n=>`<button class="outline half-hit" data-n="${n}" data-mult="${mult}">${mult===2?'D':'T'}${n}</button>`).join('')}${bull}</div>`;
 }else{
  const nums=Array.from({length:20},(_,i)=>i+1);
  host.innerHTML=`<div class="half-multiplier"><button class="outline half-mult ${selectedMult===1?'active':''}" data-mult="1">SINGLE</button><button class="outline half-mult ${selectedMult===2?'active':''}" data-mult="2">DOBBEL</button><button class="outline half-mult ${selectedMult===3?'active':''}" data-mult="3">TRIPPEL</button></div><div class="half-number-grid">${nums.map(n=>`<button class="outline half-hit" data-n="${n}" data-mult="${selectedMult}">${selectedMult===1?'S':selectedMult===2?'D':'T'}${n}</button>`).join('')}<button class="outline half-hit" data-n="25" data-mult="${selectedMult}" ${selectedMult===3?'disabled':''}>${selectedMult===1?'25':selectedMult===2?'50':'BULL'}</button></div>`;
 }
 host.querySelectorAll('.half-hit').forEach(b=>{b.disabled=b.disabled||!enabled;b.onclick=()=>addDart(Number(b.dataset.n),Number(b.dataset.mult))});
 host.querySelectorAll('.half-mult').forEach(b=>{b.disabled=!enabled;b.onclick=()=>{selectedMult=Number(b.dataset.mult);buildPad()}});
}
function renderEntry(){const items=selectedDarts.map(d=>`<div class="half-dart">${esc(dartLabel(d))}</div>`);while(items.length<3)items.push('<div class="half-dart empty">–</div>');$('soloDarts').innerHTML=items.join('');$('soloMissBtn').disabled=finished||selectedDarts.length>=3;$('soloUndoBtn').disabled=finished||!selectedDarts.length;$('soloSubmitBtn').disabled=finished||selectedDarts.length!==3;buildPad()}
function renderExactChoices(){const wrap=$('exactChoiceWrap'),r=currentRound();if(mode!=='dartcounter'||r?.type!=='exact'){wrap.classList.add('hidden');wrap.innerHTML='';return}wrap.classList.remove('hidden');const lockChoice=selectedDarts.length>0&&exactTarget!=null;wrap.innerHTML=exactOptions.map(n=>`<button class="outline ${exactTarget===n?'active':''}" data-target="${n}" ${lockChoice?'disabled':''}>${n}</button>`).join('');wrap.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(lockChoice)return;exactTarget=Number(b.dataset.target);$('soloTarget').textContent=`Eksakt ${exactTarget}`;$('soloMessage').textContent='';renderExactChoices()})}
function roundLabel(r){if(r.type==='exact')return exactTarget?`Eksakt ${exactTarget}`:'Eksakt score';return r.label}
function renderHistory(){const body=$('soloHistory');body.innerHTML=history.map(h=>`<tr><td>${h.round}.</td><td>${esc(h.target)}</td><td>${h.success?`+${h.points}`:'HALVERT'}</td><td>${h.score}</td></tr>`).join('');$('soloProgress').textContent=`${history.length}/12`}
function render(){setModeText();const r=currentRound();$('soloRoundLabel').textContent=finished?'Ferdig':`Runde ${roundIndex+1} av 12`;$('soloHelp').textContent=r?.help||'';$('soloScore').textContent=String(score);$('soloTarget').textContent=r?roundLabel(r):'Ferdig';renderExactChoices();renderEntry();renderHistory()}
function evaluateRound(r,darts){let points=0,success=false;const nonmiss=darts.filter(d=>d.n!==0),total=darts.reduce((s,d)=>s+dartValue(d),0);
 if(r.type==='number'){points=darts.filter(d=>d.n===r.target).reduce((s,d)=>s+dartValue(d),0);success=points>0}
 else if(r.type==='double'){points=darts.filter(d=>d.mult===2).reduce((s,d)=>s+dartValue(d),0);success=points>0}
 else if(r.type==='treble'){points=darts.filter(d=>d.mult===3).reduce((s,d)=>s+dartValue(d),0);success=points>0}
 else if(r.type==='bull'){points=darts.filter(d=>d.n===25).reduce((s,d)=>s+dartValue(d),0);success=points>0}
 else if(r.type==='different'){const colors=darts.map(dartColor);success=nonmiss.length===3&&new Set(colors).size===3;if(success)points=total}
 else if(r.type==='same'){const colors=darts.map(dartColor);success=nonmiss.length===3&&new Set(colors).size===1;if(success)points=total}
 else if(r.type==='exact'){success=exactTarget!=null&&total===exactTarget;if(success)points=total}
 else if(r.type==='exact41'){success=nonmiss.length===3&&total===41;if(success)points=41}
 return{success,points,total}}
function submitRound(){if(finished||selectedDarts.length!==3)return;const r=currentRound();if(r.type==='exact'&&!exactTarget){$('soloMessage').textContent='Velg et måltall først.';return}const result=evaluateRound(r,selectedDarts),before=score;if(result.success)score+=result.points;else score=mode==='standard'?Math.ceil(score/2):Math.floor(score/2);history.push({round:roundIndex+1,target:roundLabel(r),success:result.success,points:result.points,score,before,darts:selectedDarts.map(d=>({...d}))});$('soloMessage').textContent=result.success?`+${result.points} poeng`:`Bom på oppgaven – score halvert til ${score}`;selectedDarts=[];selectedMult=1;roundIndex++;exactTarget=null;if(roundIndex>=rounds.length){finished=true;showFinished();return}if(mode==='dartcounter'&&currentRound().type==='exact')exactOptions=generateExactOptions();render()}
function showFinished(){renderHistory();$('soloScore').textContent=String(score);const ok=history.filter(h=>h.success).length,fail=history.length-ok;$('soloFinishedTitle').textContent=mode==='dartcounter'?'Half-It (DartCounter)':'Half-It (Standard)';$('soloFinishedScore').textContent=String(score);$('soloFinishedStats').textContent=`${ok} treffrunder • ${fail} halveringer • ${Math.round(ok/history.length*100)} % suksess`;$('soloFinished').classList.remove('hidden')}
function restart(){roundIndex=0;score=0;selectedDarts=[];selectedMult=1;history=[];exactTarget=null;exactOptions=generateExactOptions();finished=false;$('soloFinished').classList.add('hidden');$('soloMessage').textContent='';render()}
$('soloMissBtn').onclick=()=>addDart(0,0);$('soloUndoBtn').onclick=()=>{selectedDarts.pop();renderEntry();renderExactChoices()};$('soloSubmitBtn').onclick=submitRound;$('soloRestartBtn').onclick=restart;$('soloOtherVariantBtn').onclick=()=>location.href=`half-it-solo.html?mode=${mode==='standard'?'dartcounter':'standard'}`;$('soloLobbyBtn').onclick=()=>location.href='./';$('backBtn').onclick=()=>location.href='./';
exactOptions=generateExactOptions();render();