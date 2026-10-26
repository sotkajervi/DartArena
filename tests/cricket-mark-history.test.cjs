const test = require('node:test');
const assert = require('node:assert/strict');
const { display } = require('../cricket-mark-history.js');
const visit = (player, marks, leg = 1, stage = 0) => ({
  player, leg, stage, darts: [{ target: '20', mult: marks }]
});
// The board filters current leg (and Chicago stage) before display().
const show = (visits, current, { leg = 1, stage } = {}) => display(
  visits.filter(v => Number(v.leg) === leg && (stage === undefined || Number(v.stage) === stage)),
  0, '20', current
);

test('single visit shows slash, cross, or just a closing circle', () => {
  assert.equal(show([visit(0, 1)], 1), '╱');
  assert.equal(show([visit(0, 2)], 2), '×');
  assert.equal(show([visit(0, 3)], 3), '◯');
});
test('closure preserves marks from earlier visits', () => {
  assert.equal(show([visit(0, 1), visit(0, 2)], 3), '╱ ◯');
  assert.equal(show([visit(0, 2), visit(0, 1)], 3), '× ◯');
  assert.equal(show([visit(0, 1), visit(0, 1), visit(0, 1)], 3), '╱ ╱ ◯');
});
test('other player, other leg, and overflow do not change the marks', () => {
  assert.equal(show([visit(1, 3), visit(0, 1), visit(0, 3)], 3), '╱ ◯');
  assert.equal(show([visit(0, 3, 2), visit(0, 1)], 1), '╱');
});
test('Chicago stage filtering and cached state fallback', () => {
  assert.equal(show([visit(0, 2, 1, 1), visit(0, 3, 1, 2)], 3, { stage: 2 }), '◯');
  assert.equal(show([visit(0, 1)], 3), '◯');
  assert.equal(show([], 0), '–');
});
test('corrected visit recomputes its historic symbol', () => {
  assert.equal(show([visit(0, 1), visit(0, 2)], 3), '╱ ◯');
  assert.equal(show([visit(0, 2), visit(0, 1)], 3), '× ◯');
});
