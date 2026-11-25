const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const part=(p,start,end)=>{const s=read(p),i=s.indexOf(start),j=s.indexOf(end,i+start.length);a.ok(i>=0&&j>i,p);return s.slice(i,j)};
const plain=v=>JSON.parse(JSON.stringify(v)),miss={n:0,mult:0},d19={n:19,mult:2},d10={n:10,mult:2},d5={n:5,mult:2};
function setup(){
 const nodes={},calls=[],noop=()=>{},$=id=>nodes[id]??=( {disabled:false,classList:{remove:noop,toggle:noop},innerHTML:'',textContent:''} );
 const c={$,document:{querySelector:()=>null,getElementById:$},selectedDarts:[],selectedMult:1,submitting:false,allowed:true,canThrow:()=>c.allowed&&!c.submitting,buildPad:noop,renderEntry:noop,render:noop,renderHistory:noop,esc:String,dartLabel:d=>String(d.n),dartColor:()=>'',colorLabel:()=>'',dartValue:d=>d.n*d.mult,matchId:'test',m:{status:'playing',turn_player_id:'p'},profile:{id:'p'},names:{},visits:[],state:{exact_options:[41,61,121]},currentRound:()=>({type:'double'}),currentRoundNo:()=>3,db:{rpc:async(name,args)=>{calls.push({name,darts:plain(args.p_darts)});return{data:{success:true}}}},refreshGame:async()=>{},setPlayersUnavailable:async()=>{}};
 return {c,nodes,calls,$};
}
for(const p of ['half-it-standard.js','half-it.js','half-it-multileg.js'])test(p+' enables mouse submit for one or two darts, sends exactly three, and rejects an empty or opponent turn',async()=>{
 const {c,calls,$}=setup();
 const base=p==='half-it-multileg.js'?'half-it.js':p;
 vm.createContext(c);vm.runInContext(part(base,'function renderEntry(){','function renderHistory(){'),c);
 if(p==='half-it-multileg.js')vm.runInContext(part(p,'const submitHalfItMulti=async()=>{',"$('halfSubmitBtn').onclick=submitHalfItMulti;")+"$('halfSubmitBtn').onclick=submitHalfItMulti;",c);
 else vm.runInContext(part(p,'async function submitRound(){',"$('halfMissBtn').onclick=")+"$('halfSubmitBtn').onclick=submitRound;",c);
 c.renderEntry();a.equal($('halfSubmitBtn').disabled,true);await $('halfSubmitBtn').onclick();a.equal(calls.length,0);
 for(const input of [[d19],[d19,d10],[d19,d10,d5],[miss]]){
 c.selectedDarts=plain(input);c.renderEntry();a.equal($('halfSubmitBtn').disabled,false);await $('halfSubmitBtn').onclick();a.deepEqual(calls.at(-1).darts,[...input,...Array(3-input.length).fill(miss)]);a.equal(c.selectedDarts.length,0);
 }
 c.allowed=false;c.selectedDarts=[d19];c.renderEntry();a.equal($('halfSubmitBtn').disabled,true);await $('halfSubmitBtn').onclick();a.equal(calls.length,4);
});
test('DartCounter exact target path pads misses without dropping target validation',async()=>{
 const {c,calls,$}=setup();c.currentRound=()=>({type:'exact'});c.m=null;c.canThrow=()=>!!c.m&&!c.submitting;
 vm.createContext(c);
 vm.runInContext(read('half-it-exact-choice.js'),c);
 c.m={status:'playing',turn_player_id:'p',current_leg:1};
 c.selectedDarts=[d19];c.renderEntry();a.equal($('halfSubmitBtn').disabled,true);await $('halfSubmitBtn').onclick();a.equal(calls.length,0);
 c.selectedDarts=[miss];c.renderEntry();a.equal($('halfSubmitBtn').disabled,false);await $('halfSubmitBtn').onclick();a.deepEqual(calls[0].darts,[{...miss,exact_target:41},miss,miss]);
});
for(const mode of ['standard','dartcounter'])test('Solo '+mode+' pads double hits and misses and retains rounding',()=>{
 const {c,$}=setup();Object.assign(c,{mode,finished:false,score:51,roundIndex:0,history:[],rounds:[{}, {}, {}, {}],exactTarget:null,showFinished:()=>{},roundLabel:()=> 'Double'});
 vm.createContext(c);vm.runInContext(part('half-it-solo.js','function renderEntry(){','function renderExactChoices(){')+part('half-it-solo.js','function evaluateRound(r,darts){','function showFinished(){'),c);
 c.renderEntry();a.equal($('soloSubmitBtn').disabled,true);c.submitRound();a.equal(c.history.length,0);
 c.selectedDarts=[d19];c.renderEntry();a.equal($('soloSubmitBtn').disabled,false);c.submitRound();a.equal(c.score,89);a.deepEqual(plain(c.history[0].darts),[d19,miss,miss]);
 c.selectedDarts=[miss];c.submitRound();a.equal(c.score,mode==='standard'?45:44);
});
