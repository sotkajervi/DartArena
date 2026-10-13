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
  "globalThis.__challengeTest = { startForProfile, loadSentChallenges, sendInvite, withdrawChallenge, openAcceptedRoom, observed: () => [...observedPendingChallengeIds] };\n})();");

function makeLobby(initialRows, { autoPopupAllowed = false } = {}) {
  let rows = initialRows.map(row => ({ ...row }));
  let sentUpdate = null;
  let manualGesture = false;
  let nextId = 1;
  const navigations = [];
  const tabs = [];
  const popupCalls = [];
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
    sendInvite: async () => {},
    enterAcceptedRoom() {},
    esc: value => String(value),
    setInterval() {},
    console,
    alert() {},
    location: { origin: 'https://dartarena.test' },
    document: {
      getElementById(id) {
        return id === 'sentChallengeList' ? sentHost
          : id === 'acceptedRoomPrompt' ? prompt : null;
      },
      querySelectorAll() { return []; }
    },
    window: {
      focus() {},
      location: { assign(url) { navigations.push(url); } },
      open(url, name) {
        popupCalls.push({ url, name });
        if (!autoPopupAllowed && !manualGesture) return null;
        const tab = {
          closed: false,
          location: { href: url },
          document: { title: '', body: { innerHTML: '' } },
          focusCount: 0,
          blur() {},
          focus() { this.focusCount++; },
          close() { this.closed = true; }
        };
        tabs.push(tab);
        return tab;
      },
      addEventListener() {}
    },
    db: {
      from(table) {
        const query = {
          filters: [],
          allowed: [],
          singleRow: false,
          operation: null,
          select() { return this; },
          eq(field, value) { this.filters.push([field, value]); return this; },
          in(field, values) { this.allowed.push([field, values]); return this; },
          order() { return this; },
          limit() { return this; },
          maybeSingle() { this.singleRow = true; return this; },
          single() { this.singleRow = true; return this; },
          insert(payload) { this.operation = { type: 'insert', payload }; return this; },
          update(payload) { this.operation = { type: 'update', payload }; return this; },
          then(resolve, reject) {
            let candidates = table === 'challenges' ? rows
              : [{ id: 'user-b', username: 'Opponent' }];
            if (this.operation?.type === 'insert') {
              const inserted = { id: 'new-invite-' + nextId++, ...this.operation.payload };
              rows.push(inserted);
              candidates = [inserted];
            } else {
              candidates = candidates.filter(row =>
                this.filters.every(([field, value]) => row[field] === value) &&
                this.allowed.every(([field, values]) => values.includes(row[field]))
              );
              if (this.operation?.type === 'update') {
                candidates.forEach(row => Object.assign(row, this.operation.payload));
              }
            }
            return Promise.resolve({
              data: this.singleRow ? candidates[0] || null : candidates,
              error: null
            }).then(resolve, reject);
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
    sentHost,
    prompt,
    tabs,
    popupCalls,
    navigations,
    setRows(updated) { rows = updated.map(row => ({ ...row })); },
    emit(row) { sentUpdate?.({ new: row }); },
    setActiveMatch(match) { context.activeMatch = match; },
    async invite() {
      const button = { disabled: false, dataset: { id: 'user-b' }, textContent: 'Utfordre' };
      await context.__challengeTest.sendInvite(button);
      return button;
    },
    manualOpen(id) {
      manualGesture = true;
      try { return context.__challengeTest.openAcceptedRoom(id, true); }
      finally { manualGesture = false; }
    }
  };
}

const pending = (id, status = 'pending') => ({
  id, challenger_id: 'user-a', challenged_id: 'user-b', status
});
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

test('old accepted invitations do not open a new room on login', async () => {
  const lobby = makeLobby([pending('older', 'room')]);
  await lobby.hooks.startForProfile();
  assert.equal(lobby.tabs.length, 0);
  assert.deepEqual(lobby.navigations, []);
});

test('sending an invitation leaves the lobby visible and opens no tabs', async () => {
  const lobby = makeLobby([]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  assert.equal(lobby.tabs.length, 0);
  assert.equal(lobby.popupCalls.length, 0);
  assert.deepEqual(Array.from(lobby.hooks.observed()), ['new-invite-1']);
  assert.deepEqual(lobby.navigations, []);
});
test('sending before the initial lobby watcher starts opens no tabs', async () => {
  const lobby = makeLobby([]);
  await lobby.invite();
  await lobby.hooks.startForProfile();
  assert.equal(lobby.tabs.length, 0);
  assert.equal(lobby.popupCalls.length, 0);
  assert.deepEqual(lobby.navigations, []);
});
test('clicking Trekk tilbake cancels the invitation without opening a tab', async () => {
  const lobby = makeLobby([]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  await lobby.hooks.withdrawChallenge({
    disabled: false,
    dataset: { id: 'new-invite-1' },
    textContent: 'Trekk tilbake'
  });
  assert.equal(lobby.popupCalls.length, 0);
  assert.deepEqual(lobby.navigations, []);
});
test('acceptance attempts a new tab only after approval when popups are allowed', async () => {
  const lobby = makeLobby([], { autoPopupAllowed: true });
  await lobby.hooks.startForProfile();
  await lobby.invite();
  assert.equal(lobby.popupCalls.length, 0);
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.equal(lobby.popupCalls.length, 1);
  assert.equal(lobby.tabs.length, 1);
  assert.equal(lobby.tabs[0].location.href, 'room.html?id=new-invite-1');
  assert.equal(lobby.prompt.hidden, true);
  assert.deepEqual(lobby.navigations, []);
});
test('repeat updates do not open or redirect a second room tab', async () => {
  const lobby = makeLobby([], { autoPopupAllowed: true });
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  await lobby.hooks.loadSentChallenges();
  lobby.emit(pending('new-invite-1', 'room'));
  await settle();
  assert.equal(lobby.tabs.length, 1);
  assert.equal(lobby.popupCalls.length, 1);
  assert.deepEqual(lobby.navigations, []);
});

test('withdrawal or rejection never opens a tab', async () => {
  const lobby = makeLobby([]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([]);
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.popupCalls.length, 0);
  assert.deepEqual(lobby.navigations, []);
});
test('declined realtime update does not open a tab', async () => {
  const lobby = makeLobby([]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.emit(pending('new-invite-1', 'declined'));
  await settle();
  assert.equal(lobby.popupCalls.length, 0);
  assert.equal(lobby.tabs.length, 0);
});
test('stale acceptance event is checked against the server status', async () => {
  const lobby = makeLobby([pending('stale')]);
  await lobby.hooks.startForProfile();
  lobby.setRows([pending('stale', 'cancelled')]);
  lobby.emit(pending('stale', 'room'));
  await settle();
  assert.equal(lobby.tabs.length, 0);
  assert.deepEqual(lobby.navigations, []);
});

test('active match prevents automatic room opening', async () => {
  const lobby = makeLobby([], { autoPopupAllowed: true });
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setActiveMatch({ id: 'match-in-progress' });
  lobby.setRows([pending('new-invite-1', 'room')]);
  lobby.emit(pending('new-invite-1', 'room'));
  await settle();
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.popupCalls.length, 0);
  assert.deepEqual(lobby.navigations, []);
});
test('blocked popup shows an explicit open-room fallback, not same-tab navigation', async () => {
  const lobby = makeLobby([]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.equal(lobby.prompt.hidden, false);
  assert.match(lobby.prompt.innerHTML, /Åpne venterom/);
  assert.equal(lobby.tabs.length, 0);
  assert.deepEqual(lobby.navigations, []);
  assert.equal(lobby.manualOpen('new-invite-1'), true);
  assert.equal(lobby.tabs[0].location.href, 'room.html?id=new-invite-1');
  assert.equal(lobby.prompt.hidden, true);
});

test('the user can manually reopen a previously accepted room after login', async () => {
  const lobby = makeLobby([pending('previous', 'room')]);
  await lobby.hooks.startForProfile();
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.popupCalls.length, 0);
  assert.match(lobby.sentHost.innerHTML, /open-room-challenge/);
  assert.equal(lobby.manualOpen('previous'), true);
  assert.equal(lobby.tabs[0].location.href, 'room.html?id=previous');
  assert.deepEqual(lobby.navigations, []);
});
test('reverse incoming challenge accepted via Utfordre opens no early tab', async () => {
  const lobby = makeLobby([{
    id: 'reverse', challenger_id: 'user-b', challenged_id: 'user-a', status: 'pending'
  }]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  assert.equal(lobby.popupCalls.length, 1);
  assert.equal(lobby.tabs.length, 0);
  assert.equal(lobby.prompt.hidden, false);
  assert.equal(lobby.manualOpen('reverse'), true);
  assert.equal(lobby.tabs[0].location.href, 'room.html?id=reverse');
  assert.deepEqual(lobby.navigations, []);
});
test('lobby refresh delegates accepted-room tracking to the outgoing manager', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(app, /checkMyAcceptedChallenge/);
  assert.match(app, /await Promise\.all\(\[loadPlayers\(profileId\),loadChallenges\(profileId\)\]\)/);
  assert.match(index, /<script src="app\.js[^"]*"><\/script>[\s\S]*<script src="challenge-outgoing\.js/);
  assert.match(source, /loadChallenges=async function\(\)\{const result=await baseLoadChallenges\(\);await loadSentChallenges\(\);return result\}/);
  assert.match(source, /if\(c\.status==='room'&&observedPendingChallengeIds\.has\(c\.id\)\)enterAcceptedRoom\(c\.id\)/);
  assert.doesNotMatch(source, /window\.location\.assign\(/);
  assert.doesNotMatch(source, /window\.open\('about:blank'/);
});

test('large accepted-room banner appears when automatic popup is blocked', async () => {
  const lobby = makeLobby([]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.equal(lobby.prompt.hidden, false);
  assert.match(lobby.prompt.innerHTML, /da-room-ready/);
  assert.match(lobby.prompt.innerHTML, /Utfordringen er godtatt!/);
  assert.match(lobby.prompt.innerHTML, /da-room-ready-button/);
  assert.match(lobby.prompt.innerHTML, /Åpne venterom/);
  assert.equal(lobby.tabs.length, 0);
});

test('large banner also appears after F5 when an accepted invitation is waiting', async () => {
  const lobby = makeLobby([pending('previous', 'room')]);
  await lobby.hooks.startForProfile();
  await settle();
  assert.equal(lobby.popupCalls.length, 0);
  assert.equal(lobby.prompt.hidden, false);
  assert.match(lobby.prompt.innerHTML, /Utfordringen er godtatt!/);
  assert.equal(lobby.manualOpen('previous'), true);
  assert.equal(lobby.prompt.hidden, true);
});

test('banner stays hidden when a room tab is already open', async () => {
  const lobby = makeLobby([], { autoPopupAllowed: true });
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.tabs.length, 1);
  assert.equal(lobby.prompt.hidden, true);
});

test('banner reappears after an open room tab is closed', async () => {
  const lobby = makeLobby([], { autoPopupAllowed: true });
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  lobby.tabs[0].close();
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.prompt.hidden, false);
  assert.match(lobby.prompt.innerHTML, /Åpne venterom/);
});

test('banner disappears if the accepted room is cancelled', async () => {
  const lobby = makeLobby([pending('previous', 'room')]);
  await lobby.hooks.startForProfile();
  assert.equal(lobby.prompt.hidden, false);
  lobby.setRows([]);
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.prompt.hidden, true);
});
