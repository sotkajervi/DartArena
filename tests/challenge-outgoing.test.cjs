'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'challenge-outgoing.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const roomSource = fs.readFileSync(path.join(__dirname, '..', 'room.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(__dirname, '..', 'app-game-router.js'), 'utf8');
const marker = /\}\)\(\);\s*$/;
assert.match(source, marker);
const instrumented = source.replace(marker,
  "globalThis.__challengeTest={startForProfile,loadSentChallenges,sendInvite,withdrawChallenge,openAcceptedRoom,observed:()=>[...observedPendingChallengeIds]};\n})();");

const pending = (id, status = 'pending', from = 'user-a', to = 'user-b') => ({
  id, challenger_id: from, challenged_id: to, status
});
async function settle() { for (let i = 0; i < 24; i++) await Promise.resolve(); }

function makeLobby(initialRows = []) {
  let rows = initialRows.map(row => ({ ...row }));
  let sentUpdate = null, nextId = 1, statusCheckError = null;
  const navigations = [], popupCalls = [];
  const sentHost = { innerHTML: '', querySelectorAll() { return []; } };
  const prompt = { hidden: true, innerHTML: '', querySelector() { return { onclick: null }; } };
  const context = {
    profile: { id: 'user-a' },
    activeMatch: null,
    loadChallenges: async () => {},
    loadPlayers: async () => {},
    loadLobby: async () => {},
    sendInvite: async () => {},
    enterAcceptedRoom() {},
    esc: v => String(v),
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
      location: { assign(url) { navigations.push(url); } },
      open(...args) { popupCalls.push(args); return null; },
      addEventListener() {}
    },
    db: {
      from(table) {
        return {
          filters: [], allowed: [], singleRow: false, operation: null,
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
            if (statusCheckError && this.singleRow && this.filters.some(([key]) => key === 'challenger_id')) {
              return Promise.resolve({ data: null, error: statusCheckError }).then(resolve, reject);
            }
            let candidates = table === 'challenges' ? rows : [
              { id: 'user-a', username: 'A' }, { id: 'user-b', username: 'B' }
            ];
            if (this.operation?.type === 'insert') {
              const row = { id: 'new-invite-' + nextId++, ...this.operation.payload };
              rows.push(row);
              candidates = [row];
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
    hooks: context.__challengeTest, navigations, popupCalls, prompt, sentHost,
    setRows(updated) { rows = updated.map(row => ({ ...row })); },
    emit(row) { sentUpdate?.({ new: row }); },
    setActiveMatch(value) { context.activeMatch = value; },
    setUser(value) { context.profile = { id: value }; },
    setStatusCheckError(error) { statusCheckError = error; },
    async invite() {
      const button = { disabled: false, dataset: { id: 'user-b' }, textContent: 'Utfordre' };
      await context.__challengeTest.sendInvite(button);
      return button;
    },
    open(id) { return context.__challengeTest.openAcceptedRoom(id); }
  };
}

test('sending a challenge stays in lobby and does not open a popup', async () => {
  const lobby = makeLobby();
  await lobby.hooks.startForProfile();
  await lobby.invite();
  assert.deepEqual(lobby.navigations, []);
  assert.deepEqual(lobby.popupCalls, []);
  assert.deepEqual(Array.from(lobby.hooks.observed()), ['new-invite-1']);
});

test('sending before outgoing listener starts still stays in lobby', async () => {
  const lobby = makeLobby();
  await lobby.invite();
  await lobby.hooks.startForProfile();
  assert.deepEqual(lobby.navigations, []);
});

test('accepted pending challenge navigates current tab to verified room', async () => {
  const lobby = makeLobby();
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.deepEqual(lobby.navigations, ['room.html?id=new-invite-1']);
  assert.deepEqual(lobby.popupCalls, []);
});

test('acceptance from realtime event navigates current tab once', async () => {
  const lobby = makeLobby();
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  lobby.emit(pending('new-invite-1', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, ['room.html?id=new-invite-1']);
});

test('repeated refresh and realtime events cannot duplicate navigation', async () => {
  const lobby = makeLobby();
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.setRows([pending('new-invite-1', 'room')]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  await lobby.hooks.loadSentChallenges();
  lobby.emit(pending('new-invite-1', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, ['room.html?id=new-invite-1']);
});

test('historical accepted challenge does not auto-navigate on login', async () => {
  const lobby = makeLobby([pending('old-room', 'room')]);
  await lobby.hooks.startForProfile();
  await settle();
  assert.deepEqual(lobby.navigations, []);
  assert.equal(lobby.prompt.hidden, false);
});

test('reloading an existing accepted room provides manual same-tab access', async () => {
  const lobby = makeLobby([pending('existing', 'room')]);
  await lobby.hooks.startForProfile();
  assert.match(lobby.sentHost.innerHTML, /open-room-challenge/);
  assert.match(lobby.prompt.innerHTML, /Gå til venterom/);
  assert.equal(lobby.open('existing'), true);
  assert.deepEqual(lobby.navigations, ['room.html?id=existing']);
  assert.equal(lobby.prompt.hidden, true);
});

test('manual room entry is idempotent while navigation is pending', async () => {
  const lobby = makeLobby([pending('old-room', 'room')]);
  await lobby.hooks.startForProfile();
  assert.equal(lobby.open('old-room'), true);
  assert.equal(lobby.open('old-room'), true);
  assert.deepEqual(lobby.navigations, ['room.html?id=old-room']);
});

test('declined and cancelled invitations do not navigate', async () => {
  const lobby = makeLobby();
  await lobby.hooks.startForProfile();
  await lobby.invite();
  lobby.emit(pending('new-invite-1', 'declined'));
  lobby.setRows([]);
  await lobby.hooks.loadSentChallenges();
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('withdrawal does not navigate', async () => {
  const lobby = makeLobby();
  await lobby.hooks.startForProfile();
  await lobby.invite();
  await lobby.hooks.withdrawChallenge({
    disabled: false, textContent: 'Trekk tilbake', dataset: { id: 'new-invite-1' }
  });
  assert.deepEqual(lobby.navigations, []);
});

test('outdated realtime acceptance is verified against current server state', async () => {
  const lobby = makeLobby([pending('stale')]);
  await lobby.hooks.startForProfile();
  lobby.setRows([pending('stale', 'cancelled')]);
  lobby.emit(pending('stale', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('status verification errors do not navigate current tab', async () => {
  const lobby = makeLobby([pending('fail')]);
  await lobby.hooks.startForProfile();
  lobby.setStatusCheckError(new Error('offline'));
  lobby.emit(pending('fail', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('active match blocks transition to another waiting room', async () => {
  const lobby = makeLobby([pending('incoming')]);
  await lobby.hooks.startForProfile();
  lobby.setActiveMatch({ id: 'playing' });
  lobby.setRows([pending('incoming', 'room')]);
  lobby.emit(pending('incoming', 'room'));
  await settle();
  assert.deepEqual(lobby.navigations, []);
});

test('reverse invitation accepted via Utfordre stays in the same tab', async () => {
  const lobby = makeLobby([pending('reverse', 'pending', 'user-b', 'user-a')]);
  await lobby.hooks.startForProfile();
  await lobby.invite();
  assert.deepEqual(lobby.navigations, ['room.html?id=reverse']);
  assert.deepEqual(lobby.popupCalls, []);
});

test('accepted-room banner disappears on cancellation', async () => {
  const lobby = makeLobby([pending('old-room', 'room')]);
  await lobby.hooks.startForProfile();
  assert.equal(lobby.prompt.hidden, false);
  lobby.setRows([]);
  await lobby.hooks.loadSentChallenges();
  assert.equal(lobby.prompt.hidden, true);
});

test('outgoing challenge manager and fallback do not create popup windows', () => {
  assert.doesNotMatch(source, /window\.open\(/);
  assert.doesNotMatch(source, /roomTabs|pendingRoomTabs/);
  assert.match(source, /window\.location\.assign\(url\)/);
  assert.match(indexSource, /<script src="app\.js[^"]*"><\/script>[\s\S]*<script src="challenge-outgoing\.js/);
  assert.doesNotMatch(appSource, /checkMyAcceptedChallenge/);
});

test('room leaves to lobby and match starts in current tab', () => {
  assert.match(roomSource, /location\.replace\('\.\/'\)/);
  assert.match(roomSource, /location\.href=`\$\{pageForVariant\(payload\.gameVariant\)\}/);
  assert.doesNotMatch(roomSource, /window\.open\(/);
});

test('active-match reopening uses same-tab navigation, including game router override', () => {
  assert.match(appSource, /function openMatch\([^)]*\)\{[^}]*window\.location\.assign/);
  assert.match(routerSource, /openMatch=function\([^)]*\)\{[^}]*window\.location\.assign/);
  assert.doesNotMatch(routerSource, /dartarena-match-\$\{id\}/);
});

// Test the actual app.js accept handler without initializing authentication or
// affecting the rest of the lobby. Only successful server confirmation navigates.
function acceptHandler({ initialStatus = 'pending', serverError = null, buttonAction = 'accepted' } = {}) {
  const first = appSource.indexOf('async function respondChallenge(b){');
  const last = appSource.indexOf('function esc(', first);
  assert.ok(first >= 0 && last > first);
  const snippet = appSource.slice(first, last);
  const navigations = [], popupCalls = [], alerts = [];
  let loaded = 0;
  const row = { id: 'room-b', status: initialStatus };
  const context = {
    window: {
      location: { assign(url) { navigations.push(url); } },
      open(...args) { popupCalls.push(args); }
    },
    alert(message) { alerts.push(message); },
    loadChallenges: async () => { loaded++; },
    db: {
      from() {
        return {
          filters: [], updateValue: null, singles: false,
          update(value) { this.updateValue = value; return this; },
          eq(field, value) { this.filters.push([field, value]); return this; },
          select() { return this; },
          maybeSingle() { this.singles = true; return this; },
          then(resolve, reject) {
            if (serverError) return Promise.resolve({ data: null, error: serverError }).then(resolve, reject);
            const matches = this.filters.every(([field, value]) => row[field] === value);
            if (matches) Object.assign(row, this.updateValue);
            return Promise.resolve({
              data: this.singles ? (matches ? { id: row.id } : null) : null,
              error: null
            }).then(resolve, reject);
          }
        };
      }
    }
  };
  vm.runInNewContext(snippet + '\nthis.__respondChallenge=respondChallenge;', context);
  return {
    async click() {
      const button = { disabled: false, textContent: 'Godta',
        dataset: { id: 'room-b', action: buttonAction } };
      await context.__respondChallenge(button);
      return button;
    },
    row, navigations, popupCalls, alerts,
    get loaded() { return loaded; }
  };
}

test('recipient Godta updates server before same-tab navigation', async () => {
  const app = acceptHandler();
  await app.click();
  assert.equal(app.row.status, 'room');
  assert.deepEqual(app.navigations, ['room.html?id=room-b']);
  assert.deepEqual(app.popupCalls, []);
});

test('recipient rejects without changing location', async () => {
  const app = acceptHandler({ buttonAction: 'declined' });
  await app.click();
  assert.equal(app.row.status, 'declined');
  assert.deepEqual(app.navigations, []);
});

test('recipient does not navigate if invitation is no longer pending', async () => {
  const app = acceptHandler({ initialStatus: 'cancelled' });
  await app.click();
  assert.deepEqual(app.navigations, []);
  assert.equal(app.alerts.length, 1);
});

test('recipient stays in lobby if server approval fails', async () => {
  const app = acceptHandler({ serverError: new Error('offline') });
  await app.click();
  assert.deepEqual(app.navigations, []);
  assert.equal(app.alerts.length, 1);
});

test('returning to lobby during an active match does not auto-redirect', () => {
  assert.doesNotMatch(appSource, /openMatch\(activeMatch\.id,false/);
  assert.match(appSource, /reopenMatchBtn'\)\.onclick=\(\)=>activeMatch&&openMatch\(activeMatch\.id,true/);
  assert.match(indexSource, /Kampen er fortsatt aktiv\. Bruk knappen for å gå tilbake til kamprommet\./);
});
