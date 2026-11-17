const test = require('node:test');
const assert = require('node:assert/strict');
const racing = require('../arcade-racing-engine.js');

const start = (laps = 1, players = [{ name: 'A' }, { name: 'B' }]) => racing.createRace({ laps, players });
const dart = (state, number, multiplier = 1) => racing.throwDart(state, { number, multiplier });
const turn = (state, number = 20, multiplier = 3) => {
  for (let i = 0; i < 3; i++) state = dart(state, number, multiplier);
  return racing.nextTurn(state);
};

test('starts a local race with valid driver count and laps', () => {
  assert.equal(start(2).goal, 840);
  assert.equal(start().players.length, 2);
  assert.throws(() => start(4));
  assert.throws(() => start(1, [{ name: 'Only one' }]));
});

test('normal scoring and three-dart turn management', () => {
  let race = start();
  race = dart(race, 20, 3);
  assert.equal(race.players[0].progress, 60);
  assert.equal(race.dart, 1);
  assert.throws(() => racing.nextTurn(race));
  race = dart(race, 20);
  race = dart(race, 0);
  assert.equal(race.players[0].progress, 80);
  assert.throws(() => dart(race, 20));
  race = racing.nextTurn(race);
  assert.equal(race.active, 1);
  assert.equal(race.dart, 0);
});

test('corner target gives precision bonus; wrong segment loses speed', () => {
  let race = start();
  race.players[0].progress = 100; // first bend, aiming for 16
  assert.equal(racing.zoneFor(100).target, 16);
  const hit = dart(race, 16);
  assert.equal(hit.players[0].progress, 140);
  assert.equal(hit.lastMove.bonus, 24);
  const miss = dart(race, 20, 3);
  assert.equal(miss.players[0].progress, 128);
});

test('winner is decided only after everyone finishes the same round', () => {
  let race = start();
  race.players[0].progress = race.goal - 10;
  race.players[1].progress = race.goal - 5;
  race = turn(race, 20);
  assert.equal(race.finished, false);
  assert.equal(race.active, 1);
  race = turn(race, 20, 3);
  assert.equal(race.finished, true);
  assert.deepEqual(race.winners, [1]);
  assert.throws(() => dart(race, 20));
});

test('invalid inputs never advance a race', () => {
  const race = start();
  assert.throws(() => dart(race, 21));
  assert.throws(() => dart(race, 25, 3));
  assert.throws(() => dart(race, 0, 2));
  assert.equal(race.dart, 0);
  assert.equal(race.players[0].progress, 0);
});

test('bot produces valid dart hits and sortable ranking', () => {
  const race = start(1, [{ name: 'A' }, { name: 'Bot', bot: true }]);
  for (const value of [0, 0.18, 0.55, 0.95]) {
    racing.normalizeThrow(racing.botThrow(race, () => value));
  }
  assert.equal(racing.ranking(race)[0].id, 0);
});
