'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {simulate}=require('../scripts/sfu-load-sim.cjs');
test('six rooms and twelve clients terminate cleanly',()=>{
 const m=simulate();
 assert.equal(m.rooms,6);
 assert.equal(m.clients,12);
 assert.equal(m.attempts,1200);
 assert.equal(m.terminated,12);
 assert.equal(m.orphanSessions,0);
 assert.equal(m.perRoom.length,6);
});
test('repeatable failure and recovery counts from seed',()=>{
 const a=simulate({rounds:40,seed:123,failurePercent:15});
 const b=simulate({rounds:40,seed:123,failurePercent:15});
 assert.equal(a.failures,b.failures);
 assert.equal(a.recoveries,b.recoveries);
 assert.ok(a.failures>0);
});
test('does not allow unbounded client counts',()=>{
 assert.throws(()=>simulate({rooms:200}));
});
