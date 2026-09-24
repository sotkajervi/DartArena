const state={scores:[501,501],legs:[0,0],turn:0,history:[]};
const $=id=>document.getElementById(id);
const playerEls=[...document.querySelectorAll(".player")];

function name(i){return $("name"+i).value.trim()||`Spiller ${i+1}`}
function render(msg){
  state.scores.forEach((s,i)=>{$("score"+i).textContent=s;$("legs"+i).textContent=`${state.legs[i]} legs`});
  playerEls.forEach((el,i)=>el.classList.toggle("active",i===state.turn));
  $("message").textContent=msg||`${name(state.turn)} kaster.`;
  $("scoreInput").value="";
  $("scoreInput").focus();
}
function snapshot(){state.history.push({scores:[...state.scores],legs:[...state.legs],turn:state.turn})}
function submit(value){
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>180){render("Ugyldig score. Bruk 0–180.");return}
  snapshot();
  const left=state.scores[state.turn]-n;
  if(left<0||left===1){state.turn=1-state.turn;render("Bust – turen går videre.");return}
  if(left===0){
    state.legs[state.turn]++;
    const winner=state.turn;
    if(state.legs[winner]>=3){render(`${name(winner)} vinner kampen!`);return}
    state.scores=[501,501];state.turn=1-state.turn;render(`${name(winner)} vinner leget.`);return
  }
  state.scores[state.turn]=left;state.turn=1-state.turn;render();
}
$("submitBtn").onclick=()=>submit($("scoreInput").value);
$("scoreInput").addEventListener("keydown",e=>{if(e.key==="Enter")submit(e.target.value)});
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>submit(b.textContent));
$("bustBtn").onclick=()=>{snapshot();state.turn=1-state.turn;render("Bust – turen går videre.")};
$("undoBtn").onclick=()=>{const x=state.history.pop();if(!x)return render("Ingenting å angre.");state.scores=x.scores;state.legs=x.legs;state.turn=x.turn;render("Siste registrering angret.")};
$("resetBtn").onclick=()=>{state.scores=[501,501];state.legs=[0,0];state.turn=0;state.history=[];render("Ny kamp startet.")};

let stream;
$("cameraBtn").onclick=async()=>{
  try{
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;$("video").srcObject=null;$("placeholder").style.display="flex";$("cameraBtn").textContent="Start kamera";return}
    stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1920},height:{ideal:1080}},audio:false});
    $("video").srcObject=stream;$("placeholder").style.display="none";$("cameraBtn").textContent="Stopp kamera";
  }catch(e){$("message").textContent="Kamera kunne ikke startes. Kontroller kameratillatelsen i nettleseren."}
};
render();