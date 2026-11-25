const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('room-half-it-multileg.js','utf8'),router=fs.readFileSync('game-router.js','utf8');
function scene(){
 const ids=['roomGame','roomLegs','setsModeBtn','legsModeBtn','legsField','sixtyOneTimeField'];
 const els=Object.fromEntries(ids.map(id=>[id,{value:'5',disabled:false,classList:{toggle(){}}}]));
 els.roomGame.value='501';
 const env={window:{},$:id=>els[id],selectedGame:()=>els.roomGame.value,setMatchMode:m=>env.mode=m,syncGameMode(){},showProposal(){}};
 vm.createContext(env);vm.runInContext(router,env);vm.runInContext(source,env);
 return {els,env,choose:g=>{els.roomGame.value=g;els.roomGame.onchange()}};
}
test('Pentathlon locks one leg, disables sets and selects legs mode',()=>{
 const {els,env,choose}=scene();choose('pentathlon');
 a.equal(els.roomLegs.value,'1');a.equal(els.roomLegs.disabled,true);a.equal(els.setsModeBtn.disabled,true);a.equal(env.mode,'legs');
});
test('Leaving Pentathlon unlocks legs for 501, Cricket, Half-It and 61',()=>{
 const {els,choose}=scene();
 for(const g of ['501','cricket','half_it','half_it_standard','sixty_one']){
  choose('pentathlon');choose(g);a.equal(els.roomLegs.disabled,false,g);els.roomLegs.value='5';a.equal(els.roomLegs.value,'5');
 }
 choose('501');a.equal(els.setsModeBtn.disabled,false);
 choose('pentathlon');choose('chicago');a.equal(els.roomLegs.value,'3');a.equal(els.roomLegs.disabled,false);
});
test('Updated override is loaded and disabled selector has a visual state',()=>{
 const html=fs.readFileSync('room.html','utf8');
 a.match(html,/room-half-it-multileg\.js\?v=20261125-penta-leg1/);
 a.match(html,/#roomLegs:disabled\{[^}]*opacity:\.48/);
 a.match(fs.readFileSync('room-secure-create.js','utf8'),/\(jdc\|\|raw==='pentathlon'\)\?1/);
});
