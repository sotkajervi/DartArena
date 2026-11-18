const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../pentathlon-2p-engine.js');
const newGame=()=>E.create({name1:'A',name2:'B',starter:0});
const dart=(n,m=1)=>({n,m});
function advanceTo(game,id){
  let s=game;
  while(s.status==='review'||s.current.kind!=='x01'){
    if(s.status==='review')s=E.nextStage(s);
    else throw Error('Unsupported shortcut');
  }
  return s;
}
test('seven stages contain exactly two 501, 1001, 2001, Shanghai, Clock and Half-It',()=>{
  assert.deepEqual(E.STAGES.map(s=>s.id),['501a','501b','1001','2001','shanghai','clock','half']);
  assert.equal(newGame().current.remaining[0],501);
});
test('95-130 gives one, 131-159 two, 160-180 three pent points',()=>{
  assert.equal(E.pointsForVisit(94),0);assert.equal(E.pointsForVisit(95),1);
  assert.equal(E.pointsForVisit(130),1);assert.equal(E.pointsForVisit(131),2);
  assert.equal(E.pointsForVisit(159),2);assert.equal(E.pointsForVisit(160),3);
  assert.equal(E.pointsForVisit(180),3);
});
test('checkout and fastest-leg bonuses are validated',()=>{
  assert.equal(E.finishBonus(9),10);assert.equal(E.finishBonus(10),4);
  assert.equal(E.finishBonus(12),4);assert.equal(E.finishBonus(15),3);
  assert.equal(E.finishBonus(18),2);assert.equal(E.finishBonus(21),1);
  assert.equal(E.finishBonus(22),0);
  assert.equal(E.isCheckout(40,1),true);
  assert.equal(E.isCheckout(39,1),false);
});
test('X01 records tons, bust without score and 100+ metric',()=>{
  let s=newGame();s=E.submitX01(s,{score:100});
  assert.equal(s.current.remaining[0],401);
  assert.equal(s.current.pent[0],1);
  assert.equal(s.current.visitCounts[0].tons,1);
  s=E.submitX01(s,{score:140});
  assert.equal(s.current.pent[1],2);
  assert.throws(()=>E.submitX01(s,{score:1500,bust:true}));
});
test('X01 bust does not accumulate pent points',()=>{
  let s=newGame();s=E.submitX01(s,{score:180});
  const left=s.current.remaining[0];
  s=E.submitX01(s,{score:0});
  s=E.submitX01(s,{score:180,bust:true});
  assert.equal(s.current.remaining[0],left);
  assert.equal(s.current.pent[0],3);
});
test('finish creates a stage summary and double-out required',()=>{
  let s=newGame();
  s.current.remaining[0]=40;
  assert.throws(()=>E.submitX01(s,{score:40,darts:1}));
  s=E.submitX01(s,{score:40,darts:1,doubleConfirmed:true});
  assert.equal(s.status,'review');
  assert.equal(s.total[0],2);
  assert.equal(s.summaries[0].winner,0);
  assert.equal(s.current.used[0],1);
  s=E.nextStage(s);assert.equal(s.stageIndex,1);
  assert.equal(s.current.starter,1);
});
test('Shanghai earns 1+2+3+6 points for a valid Shanghai',()=>{
  let s=newGame();s.stageIndex=4;s.current=E.create({name1:'X',name2:'Y',starter:0}).current;
  s.current={...s.current,kind:'shanghai',start:null,remaining:[0,0]};
  s=E.submitDart(s,dart(1,1));
  s=E.submitDart(s,dart(1,2));
  s=E.submitDart(s,dart(1,3));
  assert.equal(s.current.pent[0],12);
  assert.equal(s.current.turn,1);
  assert.equal(E.currentTarget(s).number,1);
});
test('Clock double 1 progresses and awards 42-arrow finish bonus',()=>{
  let s=newGame();s.stageIndex=5;s.current.kind='clock';s.current.start=null;s.current.remaining=[0,0];
  for(let i=1;i<=20;i++){
    s.current.turn=0;
    s=E.submitDart(s,dart(i,2));
  }
  assert.equal(s.current.clockTarget[0],21);
  assert.equal(s.current.pent[0],40+22);
  assert.equal(s.current.done[0],true);
});
test('Pentathlon Half-It keeps pent points even when score halves',()=>{
  let s=newGame();s.stageIndex=6;s.current.kind='half';s.current.start=null;s.current.remaining=[0,0];
  s=E.submitDart(s,dart(20));s=E.submitDart(s,dart(20));s=E.submitDart(s,dart(20,3));
  assert.equal(s.current.pent[0],5);
  assert.equal(s.current.halfScores[0],100);
  s.current.turn=0;
  s=E.submitDart(s,dart(0,0));s=E.submitDart(s,dart(0,0));s=E.submitDart(s,dart(0,0));
  assert.equal(s.current.pent[0],5);
  assert.equal(s.current.halfScores[0],50);
  assert.equal(E.HALF[2].label,'D7');
  assert.equal(E.HALF[4].label,'T10');
  assert.equal(E.HALF[6].label,'BULL 50');
});
test('undo and restore do not lose the current stage',()=>{
  let s=E.submitX01(newGame(),{score:180});
  assert.equal(s.current.remaining[0],321);
  const recovered=E.restore(JSON.parse(JSON.stringify(s)));
  s=E.undo(recovered);
  assert.equal(s.current.remaining[0],501);
  assert.equal(s.total[0],0);
});
test('no invalid scores or impossible darts can be submitted',()=>{
  assert.throws(()=>E.submitX01(newGame(),{score:163}));
  assert.throws(()=>E.submitX01(newGame(),{score:1800}));
  assert.equal(E.isDart(dart(25,3)),false);
});


test('entire 7-stage local pentathlon completes and totals are never counted twice',()=>{
  let s=newGame();
  for(let stage=0;stage<7;stage++){
    assert.equal(s.stageIndex,stage);
    if(s.current.kind==='x01'){
      // Fast-forward the long 1001/2001 starting remainders solely in the test.
      s.current.remaining[s.current.turn]=40;
      s=E.submitX01(s,{score:40,darts:1,doubleConfirmed:true});
    }else if(s.current.kind==='shanghai'){
      while(s.status==='playing'){
        const target=E.currentTarget(s);
        s=E.submitDart(s,dart(target.number,1));
      }
      assert.equal(s.current.used[0],27);
      assert.equal(s.current.used[1],27);
    }else if(s.current.kind==='clock'){
      while(s.status==='playing'){
        const target=E.currentTarget(s);
        s=E.submitDart(s,dart(target.number,2));
      }
      assert.equal(s.current.pent[0],62);
      assert.equal(s.current.pent[1],62);
    }else if(s.current.kind==='half'){
      while(s.status==='playing'){
        const target=E.currentTarget(s);
        s=E.submitDart(s,dart(target.number,target.mult||1));
      }
      assert.equal(s.current.used[0],21);
      assert.equal(s.current.used[1],21);
    }
    assert.equal(s.status,'review');
    assert.equal(s.summaries.length,stage+1);
    assert.deepEqual(s.total,s.summaries.reduce((acc,row)=>[acc[0]+row.pent[0],acc[1]+row.pent[1]],[0,0]));
    s=E.nextStage(s);
  }
  assert.equal(s.status,'finished');
  assert.equal(s.summaries.length,7);
  assert.deepEqual(s.total,s.summaries.reduce((acc,row)=>[acc[0]+row.pent[0],acc[1]+row.pent[1]],[0,0]));
  s=E.undo(s);
  assert.equal(s.status,'review');
  assert.equal(s.summaries.length,7);
});
