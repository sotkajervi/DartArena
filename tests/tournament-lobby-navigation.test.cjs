'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const syncSource = fs.readFileSync(path.join(root, 'tournament-match-sync.js'), 'utf8');

function simulate(search, hasButton = true) {
  const revealed = [];
  let clientCreations = 0;
  let subscriptions = 0;
  const client = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async single() {
          return { data: table === 'matches'
            ? { id: 'live-1', status: 'playing' }
            : { tournament_id: 'tournament-1' } };
        }
      };
    },
    channel() {
      return {
        on() { return this; },
        subscribe() { subscriptions++; return this; }
      };
    }
  };
  const context = {
    URLSearchParams,
    location: { search, origin: 'https://dartarena.test' },
    document: {
      getElementById(id) {
        if (!hasButton || id !== 'openLobbyTabBtn') return null;
        return { classList: { remove(name) { revealed.push(name); } } };
      }
    },
    window: {
      supabase: {
        createClient() { clientCreations++; return client; }
      }
    },
    console: { warn() {}, error() {} },
    confirm() { return false; }
  };
  vm.runInNewContext(syncSource, context);
  return {
    revealed,
    get clientCreations() { return clientCreations; },
    get subscriptions() { return subscriptions; }
  };
}

test('a valid tournament match reveals its lobby button', async () => {
  const view = simulate('?id=live-1&tournamentMatch=match-1');
  assert.deepEqual(view.revealed, ['hidden']);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(view.clientCreations, 1);
});

test('ordinary matches do not reveal the tournament-only lobby button', async () => {
  const view = simulate('?id=live-1');
  await Promise.resolve();
  assert.deepEqual(view.revealed, []);
  assert.equal(view.clientCreations, 0);
});

test('incomplete tournament links do not reveal the lobby button', () => {
  const a = simulate('?tournamentMatch=match-1');
  const b = simulate('?id=live-1');
  assert.deepEqual(a.revealed, []);
  assert.deepEqual(b.revealed, []);
  assert.equal(a.clientCreations, 0);
});

test('tournament match startup tolerates a missing optional lobby button', async () => {
  const view = simulate('?id=live-1&tournamentMatch=match-1', false);
  await Promise.resolve();
  assert.deepEqual(view.revealed, []);
  assert.equal(view.clientCreations, 1);
});

test('tournament room still routes to a live match in the same tab', () => {
  const room = fs.readFileSync(path.join(root, 'tournament-match-room.js'), 'utf8');
  assert.match(room, /function goToMatch\(liveId\)\{cleanup\(\);location\.href=matchUrl\(liveId\);\}/);
  assert.match(room, /tournamentMatch=\$\{encodeURIComponent\(tournamentMatchId\)\}/);
});
