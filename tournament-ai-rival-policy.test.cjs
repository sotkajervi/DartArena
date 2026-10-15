const assert=require('node:assert/strict');
const {test}=require('node:test');
const {buildFirstRound}=require('./ai-rival-policy.js');
const isBot=s=>s?.kind==='ai_rival';
test('human v AI results in WO for human',()=>{
 const r=buildFirstRound([{id:'a'}, {id:'bot',kind:'ai_rival'}],isBot);
 assert.equal(r[0].isWO,true);assert.equal(r[0].winner.id,'a');assert.equal(r[0].player2,null);
});
test('human v human stays pending',()=>{
 const r=buildFirstRound([{id:'a'},{id:'b'}],isBot);
 assert.equal(r[0].isWO,false);assert.equal(r[0].status,'pending');
});
test('AI v AI does not invent winner',()=>{
 const r=buildFirstRound([{id:'b1',kind:'ai_rival'},{id:'b2',kind:'ai_rival'}],isBot);
 assert.equal(r[0].winner,null);assert.equal(r[0].isWO,false);
});
test('seeding order preserved across pairs',()=>{
 const r=buildFirstRound([{id:'a'},{id:'bot',kind:'ai_rival'},{id:'b'},{id:'c'}],isBot);
 assert.equal(r[0].winner.id,'a');assert.equal(r[1].player1.id,'b');assert.equal(r[1].player2.id,'c');
});
