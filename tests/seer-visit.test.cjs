const test = require('node:test');
const assert = require('node:assert/strict');
const SeerVisit = require('../seer-visit.js');

const treble = { Cam: 0, darts: 1, base_score: 20, multiplier: 3, score: 60, dx: 40, dy: 80 };
const single = { ...treble, multiplier: 1, score: 20 };
const frame = (throwId, ...observations) => ({ throwId, observations });

test('a replay and two agreeing cameras propose one T20', () => {
  const visit = new SeerVisit();
  const score = frame('a', treble, { ...treble, Cam: 1 });
  assert.ok(visit.receive(score));
  assert.equal(visit.receive(score), false);
  assert.equal(visit.total, 60);
  assert.equal(visit.darts.size, 1);
  visit.darts.clear();
  assert.equal(visit.receive(score), false);
  assert.equal(visit.total, 0);
});

test('overlapping and partial frames preserve distinct darts in the same sector', () => {
  const visit = new SeerVisit();
  visit.receive(frame('a', single));
  visit.receive(frame('b', single, { ...single, darts: 2 }));
  assert.equal(visit.total, 40);
  visit.receive(frame('c', { ...single, darts: 3 }));
  assert.equal(visit.total, 60);
});

test('conflicts require a choice, which persists through further observations', () => {
  const visit = new SeerVisit();
  visit.receive(frame('a', treble, { ...single, Cam: 1 }));
  assert.equal(SeerVisit.selected(visit.darts.get(1)), null);
  assert.equal(visit.correct(1, 'T25'), false);
  assert.ok(visit.correct(1, 'D25'));
  visit.receive(frame('b', single, { ...single, darts: 2 }));
  assert.equal(visit.total, 70);
});

test('distinguishes missing detections, real misses, invalid hits and a calibration error', () => {
  const visit = new SeerVisit();
  const missing = { Cam: 0, darts: 1, dx: 0, dy: 0, score: 0 };
  visit.receive(frame('a', missing, { ...missing, darts: 2, dx: 40 }, { ...treble, darts: 3, score: 59 }));
  assert.equal(SeerVisit.selected(visit.darts.get(1)), null);
  assert.equal(SeerVisit.selected(visit.darts.get(2)), 'MISS');
  assert.equal(SeerVisit.selected(visit.darts.get(3)), null);
  visit.receive({ ...frame('b', treble), calibrationError: true });
  assert.equal(SeerVisit.selected(visit.darts.get(1)), null);
  assert.ok(visit.correct(1, 'T20'));
  assert.equal(visit.total, 60);
  assert.equal(visit.receive(frame(null, single)), false);
});

test('a calibration error keeps the affected dart pending through recovery until corrected', () => {
  const visit = new SeerVisit();
  const bad = { ...frame('a', treble), calibrationError: true };
  visit.receive(bad, '2026-11-27T00:01:00.000Z');
  assert.deepEqual(visit.calibration, { state: 'error', receivedAt: '2026-11-27T00:01:00.000Z' });
  assert.equal(visit.total, 0);
  visit.calibration = { state: 'ready', receivedAt: '2026-11-27T00:02:00.000Z' };
  visit.receive(frame('b', treble, { ...single, darts: 2 }));
  assert.equal(visit.total, 20);
  assert.equal(visit.receive(bad, '2026-11-27T00:03:00.000Z'), false);
  assert.equal(visit.calibration.state, 'ready');
  assert.ok(visit.correct(1, 'T20'));
  assert.equal(visit.total, 80);
});
