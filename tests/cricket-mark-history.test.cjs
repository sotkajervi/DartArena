const test = require('node:test');
const assert = require('node:assert/strict');
const { display } = require('../cricket-mark-history.js');
const visit = (player, marks, leg = 1, stage = 0) => ({
  player, leg, stage, darts: [{ target: '20', mult: marks }]
});
const show = (visits, fallback, options = {}) =>
  display(visits, { player: 0, target: '20', leg: 1, fallback, ...options });

test('one, two or three marks in a single visit', () => {
  assert.equal(show([visit(0, 1)], 1), '╱');
  assert.equal(show([visit(0, 2)], 2), '×');
  assert.equal(show([visit(0, 3)], 3), '○');
});
test('closure preserves marks from previous visits', () => {
  assert.equal(show([visit(0, 1), visit(0, 2)], 3), '╱ ○');
  assert.equal(show([visit(0, 2), visit(0, 1)], 3), '× ○');
  assert.equal(show([visit(0, 1), visit(0, 1), visit(0, 1)], 3), '╱ ╱ ○');
});
test('ignore marks from other players, earlier legs, and surplus after closure', () => {
  assert.equal(show([visit(1, 3), visit(0, 1), visit(0, 3)], 3), '╱ ○');
  assert.equal(show([visit(0, 3, 2), visit(0, 1)], 1), '╱');
});
test('Chicago stage isolates cricket and tolerates cached mismatch', () => {
  assert.equal(show([visit(0, 2, 1, 1), visit(0, 3, 1, 2)], 3, { stage: 2 }), '○');
  assert.equal(show([visit(0, 1)], 3), '○');
  assert.equal(show([], 0), '–');
});
