'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'secure-match-cancel.js'), 'utf8');

function prepare({ tournament = false, playing = false } = {}) {
  const handlers = {};
  const navigations = [];
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
    confirm() { return true; }
  };
  vm.runInNewContext(source, context);
  return {
    close, cancel, message, navigations,
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

test('ordinary finished match labels its close button Til lobby', () => {
  const screen = prepare();
  assert.equal(screen.close.textContent, 'Til lobby');
});

test('ordinary finished match returns to lobby without calling window.close', async () => {
  const screen = prepare();
  await screen.click('close');
  assert.deepEqual(screen.navigations, ['./']);
  assert.equal(screen.popupCloses, 0);
});

test('ordinary active match can return to lobby without cancelling the match', async () => {
  const screen = prepare({ playing: true });
  await screen.click('close');
  assert.deepEqual(screen.navigations, ['./']);
  assert.equal(screen.rpcCalls, 0);
  assert.equal(screen.popupCloses, 0);
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
    assert.match(html, /secure-match-cancel\.js\?v=20261013-sametab1/);
  }
});

test('room-to-match navigation stays in the current tab', () => {
  const room = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  const secureCreate = fs.readFileSync(path.join(root, 'room-secure-create.js'), 'utf8');
  assert.match(room, /location\.href=`\$\{pageForVariant\(payload\.gameVariant\)\}/);
  assert.match(secureCreate, /location\.href=`\$\{page\}\?id=/);
  assert.doesNotMatch(room, /window\.open\(/);
});
