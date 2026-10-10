/* Experimental opt-in voice score, isolated from core match logic.
   Hold Space -> speak -> release -> preview; tap Space -> existing Register button.
   This module does not transmit scores except through the normal match UI.
*/
(() => {
  'use strict';
  const input=document.getElementById('matchScoreInput');
  const submit=document.getElementById('matchScoreBtn');
  if(!input||!submit)return;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const panel=document.createElement('div');
  panel.className='voice-score-panel';
  panel.innerHTML='<label class="voice-score-toggle"><input id="voiceScoreEnabled" type="checkbox"> Stemmestyring (test)</label><span id="voiceScoreStatus" role="status" aria-live="polite">Av</span>';
  input.closest('.score-entry')?.insertAdjacentElement('afterend',panel);
  const enabled=panel.querySelector('#voiceScoreEnabled');
  const status=panel.querySelector('#voiceScoreStatus');
  Object.assign(panel.style,{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap',marginTop:'8px',fontSize:'13px'});
  if(!Recognition){enabled.disabled=true;status.textContent='Talegjenkjenning støttes ikke av denne nettleseren';return;}

  // Exact digit forms and common Norwegian number words; never guess an uncertain phrase.
  const ones={null:0,én:1,en:1,ett:1,ein:1,to:2,tre:3,fire:4,fem:5,seks:6,sju:7,syv:7,åtte:8,ni:9};
  const tens={ti:10,tyve:20,tyve:20,tjue:20,tretti:30,førti:40,femti:50,seksti:60,sytti:70,åtti:80,nitti:90};
  const extras={elleve:11,tolv:12,tretten:13,fjorten:14,femten:15,seksten:16,sytten:17,atten:18,nitten:19,
    hundred:100,onehundred:100,onehundredandeighty:180,bust:0,bom:0,zero:0,null:0,twenty:20,forty:40,fifty:50,sixty:60,eighty:80,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
  const englishTens={ten:10,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const englishOnes={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
  const englishTeen={eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
  const valid=n=>Number.isInteger(n)&&n>=0&&n<=180;
  function parseNumber(raw){
    const s=String(raw||'').toLowerCase().normalize('NFC').replace(/[.,!?]/g,' ').replace(/[-]/g,' ').trim().replace(/\s+/g,' ');
    if(!s)return null;
    if(/^\d{1,3}$/.test(s)){const n=Number(s);return valid(n)?n:null}
    const compact=s.replace(/\s+/g,'');
    if(Object.prototype.hasOwnProperty.call(extras,compact))return extras[compact];
    const tokens=s.replace(/\bog\b/g,' ').replace(/\band\b/g,' ').split(/\s+/).filter(Boolean);
    let total=0,used=false;
    for(let i=0;i<tokens.length;i++){
      const w=tokens[i];
      if(w==='hundre'||w==='hundred'){
        if(total<1||total>1)return null;
        total*=100;used=true;continue;
      }
      if(w==='hundreog'||w==='hundredand')return null;
      if(Object.prototype.hasOwnProperty.call(ones,w)){total+=ones[w];used=true;continue}
      if(Object.prototype.hasOwnProperty.call(tens,w)){total+=tens[w];used=true;continue}
      if(Object.prototype.hasOwnProperty.call(englishTens,w)){total+=englishTens[w];used=true;continue}
      if(Object.prototype.hasOwnProperty.call(englishOnes,w)){total+=englishOnes[w];used=true;continue}
      if(Object.prototype.hasOwnProperty.call(englishTeen,w)){total+=englishTeen[w];used=true;continue}
      if(Object.prototype.hasOwnProperty.call(extras,w)){total+=extras[w];used=true;continue}
      // Norwegian compounds such as "førtifem" and "hundreogførti".
      const compound=Object.entries(tens).find(([k])=>w.startsWith(k)&&Object.prototype.hasOwnProperty.call(ones,w.slice(k.length)));
      if(compound){total+=compound[1]+ones[w.slice(compound[0].length)];used=true;continue}
      return null;
    }
    return used&&valid(total)?total:null;
  }
  let recognition=null,holding=false,pending=null,finalText='',serial=0,awaitingResult=false;
  function active(){return enabled.checked&&!input.disabled&&!submit.disabled}
  function setStatus(value){status.textContent=value}
  function clearPending(){pending=null}
  function begin(){
    if(!active()||holding||awaitingResult)return;
    holding=true;clearPending();finalText='';const run=++serial;
    recognition=new Recognition();
    recognition.lang='nb-NO';recognition.continuous=false;recognition.interimResults=true;
    recognition.onresult=e=>{
      if(run!==serial)return;
      for(let i=e.resultIndex;i<e.results.length;i++){
        const result=e.results[i];
        if(result.isFinal)finalText=result[0]?.transcript||'';
        else if(!finalText)setStatus('Hører: '+String(result[0]?.transcript||'').slice(0,55));
      }
    };
    recognition.onerror=e=>{
      if(run!==serial)return;
      awaitingResult=false;holding=false;setStatus('Talegjenkjenning feilet: '+e.error);recognition=null;
    };
    recognition.onend=()=>{
      if(run!==serial)return;
      awaitingResult=false;holding=false;recognition=null;
      if(!active()){setStatus('Av');return}
      const n=parseNumber(finalText);
      if(n===null){setStatus('Ingen entydig score. Prøv igjen eller tast manuelt.');return}
      input.value=String(n);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      pending=n;
      setStatus('Forslag: '+n+' – trykk Space for å bekrefte');
    };
    try{recognition.start();setStatus('Lytter… hold Space og si scoren')}catch(e){holding=false;awaitingResult=false;setStatus('Kunne ikke starte mikrofon: '+e.message)}
  }
  function stop(){
    if(!holding||!recognition)return;
    holding=false;awaitingResult=true;setStatus('Behandler tale…');
    try{recognition.stop()}catch{awaitingResult=false;setStatus('Talegjenkjenning stoppet')}
  }
  function cancel(){
    serial++;holding=false;awaitingResult=false;clearPending();
    if(recognition){try{recognition.abort()}catch{}recognition=null}
  }
  enabled.addEventListener('change',()=>{cancel();setStatus(enabled.checked?'Hold Space for å si score':'Av')});
  input.addEventListener('input',e=>{
    if(e.isTrusted&&pending!==null){clearPending();setStatus('Manuelt endret – bruk Enter')}
  });
  submit.addEventListener('click',()=>{clearPending();if(enabled.checked)setStatus('Hold Space for neste score')});
  window.addEventListener('keydown',e=>{
    if(e.code!=='Space'||e.repeat||!enabled.checked||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.target instanceof HTMLElement && (e.target.closest('button,select,textarea,[contenteditable="true"]')||e.target.closest('input')&&e.target!==input))return;
    if(!active())return;
    e.preventDefault();e.stopPropagation();
    if(pending!==null){
      if(String(input.value).trim()!==String(pending)){clearPending();setStatus('Score endret – bruk Enter');return}
      clearPending();setStatus('Registrerer…');submit.click();return;
    }
    begin();
  },true);
  window.addEventListener('keyup',e=>{
    if(e.code!=='Space'||!enabled.checked)return;
    if(!holding)return;
    e.preventDefault();e.stopPropagation();stop();
  },true);
  window.addEventListener('blur',()=>{if(holding)stop()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
})();
