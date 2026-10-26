const test = require('node:test');
const assert = require('node:assert/strict');
const { kind, display, basic } = require('../cricket-mark-history.js');

const visit = (player, marks, leg = 1, stage = 0, target = '20') => ({
  player, leg, stage, darts: [{ target, mult: marks }]
});
const show = (visits, current, { leg = 1, stage, player = 0, target = '20' } = {}) => kind(
  visits.filter(v => Number(v.leg) === leg && (stage === undefined || Number(v.stage) === stage)),
  player, target, current
);

test('the first and second marks are drawn as a slash and X', () => {
  assert.equal(show([visit(0, 1)], 1), 'slash');
  assert.equal(show([visit(0, 2)], 2), 'cross');
  assert.equal(show([visit(0, 1), visit(0, 1)], 2), 'cross');
});

test('closing the whole target in one visit shows ONLY a circle', () => {
  assert.equal(show([visit(0, 3)], 3), 'circle');
  const singleVisit = [{ player: 0, leg: 1, darts: [
    { target: '20', mult: 1 }, { target: '20', mult: 1 }, { target: '20', mult: 1 }
  ] }];
  assert.equal(show(singleVisit, 3), 'circle');
});

test('one earlier mark plus closing visit is slash INSIDE circle', () => {
  assert.equal(show([visit(0, 1), visit(0, 2)], 3), 'slash-circle');
});

test('two earlier marks plus closing visit are X INSIDE circle', () => {
  assert.equal(show([visit(0, 2), visit(0, 1)], 3), 'cross-circle');
  assert.equal(show([visit(0, 1), visit(0, 1), visit(0, 1)], 3), 'cross-circle');
});

test('SVG overlays marks inside ONE graphic rather than adding a second glyph', () => {
  for (const [visits, expectedKind, circleCount, lineCount] of [
    [[visit(0, 3)], 'circle', 1, 0],
    [[visit(0, 1), visit(0, 2)], 'slash-circle', 1, 1],
    [[visit(0, 2), visit(0, 1)], 'cross-circle', 1, 2],
    [[visit(0, 1)], 'slash', 0, 1],
    [[visit(0, 2)], 'cross', 0, 2]
  ]) {
    const rendered = display(visits, 0, '20', expectedKind === 'slash' ? 1 : expectedKind === 'cross' ? 2 : 3);
    assert.equal(rendered.includes('data-mark-kind="' + expectedKind + '"'), true);
    assert.equal((rendered.match(/<svg\b/g) || []).length, 1);
    assert.equal((rendered.match(/<circle\b/g) || []).length, circleCount);
    assert.equal((rendered.match(/<line\b/g) || []).length, lineCount);
  }
});

test('player, leg, stage and bull are not mixed up', () => {
  assert.equal(show([visit(1, 3), visit(0, 1), visit(0, 2)], 3), 'slash-circle');
  assert.equal(show([visit(0, 3, 2), visit(0, 1)], 1), 'slash');
  assert.equal(show([visit(0, 2, 1, 1), visit(0, 3, 1, 2)], 3, { stage: 2 }), 'circle');
  assert.equal(show([visit(0, 1, 1, 0, 'B'), visit(0, 2, 1, 0, 'B')], 3, { target: 'B' }), 'slash-circle');
});

test('a corrected visit is recomputed, and stale visits fall back to counts', () => {
  assert.equal(show([visit(0, 1), visit(0, 2)], 3), 'slash-circle');
  assert.equal(show([visit(0, 2), visit(0, 1)], 3), 'cross-circle');
  assert.equal(show([visit(0, 1)], 3), 'circle');
  assert.equal(show([], 0), 'empty');
  assert.equal(basic(3).includes('data-mark-kind="circle"'), true);
});
