'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'secure-match-cancel.js'), 'utf8');

function prepare({ tournament = false, playing = false, blockPopup = false } = {}) {
  const handlers = {};
  const navigations = [];
  const openedTabs = [], alerts = [];
  let popupCloses = 0;
  let rpcCalls = 0;
  const cancel = {
    dataset: {},
    classList: {
      contains(name) { return name === 'hidden' ? !playing : false; },
      add() {}
    },
    addEventListener(type, fn) { handlers['cancel-' + type] = fn; },
    textContent: 'Avbryt kamp', disabled: false
  };
  const close = {
    dataset: {},
    addEventListener(type, fn) { handlers['close-' + type] = fn; },
    textContent: 'Lukk kampfane'
  };
  const message = { textContent: '' };
  const location = {
    search: tournament ? '?id=match-1&tournamentMatch=t-1' : '?id=match-1',
    origin: 'https://dartarena.test',
    set href(value) { navigations.push(value); },
    get href() { return navigations.at(-1) || ''; }
  };
  const context = {
    location, URLSearchParams,
    console,
    window: {
      DartArenaDialog: { async confirm() { return true; } },
      supabase: {
        createClient() {
          return {
            async rpc() {
              rpcCalls++;
              return { data: { id: 'match-1' }, error: null };
            }
          };
        }
      },
      close() { popupCloses++; },
      open(url, name) {
        if (blockPopup) return null;
        const tab = { opener: context.window, focusCount: 0, focus() { this.focusCount++; } };
        openedTabs.push({ url, name, tab });
        return tab;
      },
      opener: null
    },
    document: {
      querySelector() { return null; },
      getElementById(id) {
        return { closeMatchBtn: close, cancelMatchBtn: cancel, matchMessage: message }[id] || null;
      }
    },
    setInterval() { throw new Error('The close guard must initialize immediately'); },
    setTimeout() { throw new Error('No delayed navigation should be necessary'); },
    confirm() { return true; },
    alert(message) { alerts.push(message); }
  };
  vm.runInNewContext(source, context);
  return {
    close, cancel, message, navigations, openedTabs, alerts,
    get popupCloses() { return popupCloses; },
    get rpcCalls() { return rpcCalls; },
    async click(name) {
      const event = {
        preventDefault() {},
        stopImmediatePropagation() {}
      };
      assert.equal(typeof handlers[name + '-click'], 'function');
      await handlers[name + '-click'](event);
    }
  };
}

test('ordinary match labels the lobby button Åpne lobby i ny fane', () => {
  const screen = prepare({ playing: true });
  assert.equal(screen.close.textContent, 'Åpne lobby i ny fane');
});

test('finished match lobby button also opens a separate tab', async () => {
  const screen = prepare();
  await screen.click('close');
  assert.equal(screen.openedTabs.length, 1);
  assert.equal(screen.openedTabs[0].url, './');
  assert.equal(screen.openedTabs[0].name, 'dartarena-lobby');
  assert.equal(screen.openedTabs[0].tab.opener, null);
  assert.equal(screen.openedTabs[0].tab.focusCount, 1);
  assert.deepEqual(screen.navigations, []);
  assert.equal(screen.popupCloses, 0);
});

test('ordinary active match keeps video/scoring page and match alive', async () => {
  const screen = prepare({ playing: true });
  await screen.click('close');
  assert.equal(screen.openedTabs.length, 1);
  assert.deepEqual(screen.navigations, []);
  assert.equal(screen.rpcCalls, 0);
  assert.equal(screen.popupCloses, 0);
});

test('blocked lobby popup leaves the match intact and warns the player', async () => {
  const screen = prepare({ playing: true, blockPopup: true });
  await screen.click('close');
  assert.equal(screen.openedTabs.length, 0);
  assert.equal(screen.alerts.length, 1);
  assert.match(screen.alerts[0], /blokkerte lobbyfanen/);
  assert.deepEqual(screen.navigations, []);
  assert.equal(screen.rpcCalls, 0);
});

test('repeated lobby clicks use a reusable named tab instead of new random names', async () => {
  const screen = prepare({ playing: true });
  await screen.click('close');
  await screen.click('close');
  assert.equal(screen.openedTabs.length, 2);
  assert.equal(screen.openedTabs[0].name, 'dartarena-lobby');
  assert.equal(screen.openedTabs[1].name, 'dartarena-lobby');
  assert.deepEqual(screen.navigations, []);
});

test('cancelled ordinary match returns to lobby after server RPC', async () => {
  const screen = prepare({ playing: true });
  await screen.click('cancel');
  assert.equal(screen.rpcCalls, 1);
  assert.deepEqual(screen.navigations, ['./']);
  assert.equal(screen.popupCloses, 0);
});

test('tournament close guard still uses the existing window-close behavior', async () => {
  const screen = prepare({ tournament: true, playing: true });
  assert.equal(screen.close.textContent, 'Lukk kampfane');
  await screen.click('close');
  assert.deepEqual(screen.navigations, []);
  assert.equal(screen.popupCloses, 1);
});

test('all normal online match variants load the refreshed lobby-return handler', () => {
  for (const file of ['match.html', 'cricket.html', 'half-it.html', '61-match.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /secure-match-cancel\.js\?v=20261013-lobbytab1/);
  }
});

test('room-to-match navigation stays in the current tab', () => {
  const room = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  const secureCreate = fs.readFileSync(path.join(root, 'room-secure-create.js'), 'utf8');
  assert.match(room, /location\.href=`\$\{pageForVariant\(payload\.gameVariant\)\}/);
  assert.match(secureCreate, /location\.href=`\$\{page\}\?id=/);
  assert.doesNotMatch(room, /window\.open\(/);
});

test('completed-match result screen retains a same-tab Til lobby action', () => {
  const screen = fs.readFileSync(path.join(root, 'shared-results.js'), 'utf8');
  assert.match(screen, /overlay\.querySelector\('#daResultLobby'\)\.onclick=returnFromResult/);
  assert.match(screen, /if\(!resultTournamentMatchId\)return '\.\/'/);
});


test('opponent-cancelled popup Til lobby navigates SAME tab and never calls window.close', () => {
  const script = fs.readFileSync(path.join(root, 'cancelled-match-modal.js'), 'utf8');
  for (const openedFromLobby of [false, true]) {
    const navigations = [], messages = [];
    let closeCount = 0, modal = null, lobbyClick, cleared = false;
    const button = {
      dataset: {},
      addEventListener(event, callback) {
        if (event === 'click') lobbyClick = callback;
      },
      focus() {}
    };
    const cancelledText = { textContent: '' };
    const modalClasses = { add() {}, remove() {} };
    const location = {
      origin: 'https://dartarena.test',
      search: '?id=match-1',
      set href(next) { navigations.push(next); }
    };
    const doc = {
      addEventListener() {},
      getElementById(id) {
        if (id === 'cancelledMatchModal') return modal;
        if (id === 'cancelledLobbyBtn') return button;
        if (id === 'cancelledMatchText') return cancelledText;
        return null;
      },
      createElement(tag) {
        if (tag === 'style') return { textContent: '', id: '' };
        modal = {
          id: '', className: '', classList: modalClasses,
          setAttribute() {}, innerHTML: '', querySelector() { return null; }
        };
        return modal;
      },
      head: { appendChild() {} },
      body: { appendChild() {} }
    };
    const win = {
      opener: openedFromLobby ? { postMessage: (...args) => messages.push(args) } : null,
      addEventListener() {},
      close() { closeCount++; }
    };
    vm.runInNewContext(script, {
      window: win,
      document: doc,
      location,
      URLSearchParams,
      clearInterval() { cleared = true; },
      setInterval() { return 77; },
      setTimeout() { throw new Error('Popup navigation must not use a delayed close fallback'); },
      console
    });
    assert.equal(typeof lobbyClick, 'function');
    win.DartArenaCancelledMatchModal.show();
    lobbyClick();
    assert.deepEqual(navigations, ['./']);
    assert.equal(closeCount, 0, 'An opponent cancellation must not close the browser tab');
    assert.equal(cleared, true);
    if (openedFromLobby) {
      assert.equal(messages.length, 1);
      assert.equal(messages[0][0].type, 'dartarena-match-ended');
      assert.equal(messages[0][0].id, 'match-1');
    }
  }
});

test('opponent-cancelled popup fix loads for every online game variant', () => {
  for (const file of ['match.html', 'cricket.html', 'half-it.html', '61-match.html', 'jdc-match.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /cancelled-match-modal\.js\?v=20261023-sametab1/);
  }
});
