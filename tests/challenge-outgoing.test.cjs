'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'challenge-outgoing.js'), 'utf8');
const marker = /\}\)\(\);\s*$/;
assert.match(source, marker);
const instrumented = source.replace(marker,
  "globalThis.__challengeTest = { startForProfile, loadSentChallenges, observed: () => [...observedPendingChallengeIds] };\n})();");

function makeLobby(initialRows) {
  let rows = initialRows.map(row => ({ ...row }));
  let sentUpdate = null;
  const navigations = [];
  const sentHost = { innerHTML: '', querySelectorAll() { return []; } };
  const prompt = {
    hidden: true,
    innerHTML: '',
    querySelector() { return { onclick: null }; }
  };
  const context = {
    profile: { id: 'user-a' },
    activeMatch: null,
    loadChallenges: async () => {},
    loadPlayers: async () => {},
    loadLobby: async () => {},
    esc: value => String(value),
    setInterval() {},
    console,
    document: {
      getElementById(id) {
        return id === 'sentChallengeList' ? sentHost
          : id === 'acceptedRoomPrompt' ? prompt : null;
      },
      querySelectorAll() { return []; }
    },
    window: {
      location: { assign(url) { navigations.push(url); } },
      open() { return null; },
      addEventListener() {}
    },
    db: {
      from(table) {
        const query = {
          filters: [],
          allowed: [],
          single: false,
          select() { return this; },
          eq(field, value) { this.filters.push([field, value]); return this; },
          in(field, values) { this.allowed.push([field, values]); return this; },
          order() { return this; },
          limit() { return this; },
          maybeSingle() { this.single = true; return this; },
          then(resolve, reject) {
            const sourceRows = table === 'challenges' ? rows
              : [{ id: 'user-b', username: 'Opponent' }];
            const filtered = sourceRows.filter(row =>
              this.filters.every(([field, value]) => row[field] === value) &&
              this.allowed.every(([field, values]) => values.includes(row[field]))
            );
            const data = this.single ? filtered[0] || null : filtered;
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
        };
        return query;
      },
      channel() {
        return {
          on(event, options, fn) { sentUpdate = fn; return this; },
          subscribe() { return this; }
        };
      },
      async removeChannel() {}
    }
  };

  vm.runInNewContext(instrumented, context);
  return {
    hooks: context.__challengeTest,
    navigations,
    setRows(updated) { rows = updated.map(row => ({ ...row })); },
    emit(row) { sentUpdate?.({ new: row }); },
    setActiveMatch(match) { context.activeMatch = match; }
  };
}

const pending = (id, status = 'pending') => ({
  id, challenger_id: 'user-a', challenged_id: 'user-b', status
});
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

test('existing accepted invitations do not unexpectedly redirect on login', async () => {
  const lobby = makeLobby([pending('older', 'room')]);
  await lobby.hooks.startForProfile();
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('accepted pending invitation automatically opens the correct waiting room', async () => {
  const lobby = makeLobby([pending('invite-one')]);
  await lobby.hooks.startForProfile();
  assert.deepEqual(Array.from(lobby.hooks.observed()), ['invite-one']);
  lobby.setRows([pending('invite-one', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.deepEqual(lobby.navigations, ['room.html?id=invite-one']);
});

test('repeat updates do not reopen an accepted room', async () => {
  const lobby = makeLobby([pending('invite-two')]);
  await lobby.hooks.startForProfile();
  lobby.setRows([pending('invite-two', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.deepEqual(lobby.navigations, ['room.html?id=invite-two']);
});

test('cancelled invitations are not opened', async () => {
  const lobby = makeLobby([pending('invite-three')]);
  await lobby.hooks.startForProfile();
  lobby.setRows([]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('stale acceptance events are checked against the current server status', async () => {
  const lobby = makeLobby([pending('invite-four')]);
  await lobby.hooks.startForProfile();
  lobby.setRows([pending('invite-four', 'cancelled')]);
  lobby.emit(pending('invite-four', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('an active match prevents a new waiting-room redirect', async () => {
  const lobby = makeLobby([pending('invite-five')]);
  await lobby.hooks.startForProfile();
  lobby.setActiveMatch({ id: 'match-in-progress' });
  lobby.setRows([pending('invite-five', 'room')]);
  lobby.emit(pending('invite-five', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('lobby refresh delegates accepted-room tracking to the outgoing challenge manager', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(app, /checkMyAcceptedChallenge/);
  assert.match(app, /await Promise\.all\(\[loadPlayers\(profileId\),loadChallenges\(profileId\)\]\)/);
  assert.match(index, /<script src="app\.js[^"]*"><\/script>[\s\S]*<script src="challenge-outgoing\.js/);
  assert.match(source, /loadChallenges=async function\(\)\{const result=await baseLoadChallenges\(\);await loadSentChallenges\(\);return result\}/);
  assert.match(source, /if\(c\.status==='room'&&observedPendingChallengeIds\.has\(c\.id\)\)enterAcceptedRoom\(c\.id\)/);
});
