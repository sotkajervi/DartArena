const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('pentathlon-room-test.js','utf8');
const start=src.indexOf('   const closeStage=()=>{'),end=src.indexOf("   $('ptCloseStageModal').onclick=closeStage;",start);
a.ok(start>=0&&end>start);
function close(status){
 let nav=[],focus=0;
 const overlay={hidden:false};
 vm.runInNewContext(src.slice(start,end)+'\ncloseStage()',{
   game:()=>({status}),stageOverlay:overlay,location:{replace:url=>nav.push(url)},$:()=>({focus(){focus++}})
 });
 return {nav,hidden:overlay.hidden,focus};
}
test('Finished live result closes the room and returns only this player to lobby',()=>{
 a.deepEqual(close('finished'),{nav:['./'],hidden:false,focus:0});
 a.match(src,/ptCloseStageModal'\)\.onclick=closeStage/);
 a.match(src,/textContent=finished\?'Til hovedlobby':'Lukk'/);
 a.match(src,/cancelBtn\.hidden=finished/);
});
test('Exercise review cannot be dismissed before both players confirm',()=>{
 a.deepEqual(close('review'),{nav:[],hidden:false,focus:0});
});
test('Ordinary popup dismissal is unchanged; archived final result still returns to lobby',()=>{
 a.deepEqual(close('playing'),{nav:[],hidden:true,focus:1});
 a.match(src,/ptFinishedLobby'\)\.onclick=\(\)=>location\.assign\('\.\/'\)/);
 a.match(fs.readFileSync('room.html','utf8'),/pentathlon-room-test\.js\?v=20261125-final-lobby1/);
});
