'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'open-lobby-tab.js'), 'utf8');

function createRoom({ buttonPresent = true, popupBlocked = false } = {}) {
  const handlers = {};
  const opens = [], alerts = [], navigations = [];
  const button = {
    addEventListener(type, fn) { handlers[type] = fn; }
  };
  const context = {
    document: {
      getElementById(id) {
        return buttonPresent && id === 'openLobbyTabBtn' ? button : null;
      }
    },
    window: {
      open(url, name) {
        opens.push({ url, name });
        if (popupBlocked) return null;
        return {
          opener: context.window,
          focusCount: 0,
          focus() { this.focusCount++; }
        };
      },
      location: {
        assign(url) { navigations.push(url); }
      }
    },
    alert(text) { alerts.push(text); }
  };
  vm.runInNewContext(script, context);
  return {
    opens, alerts, navigations, handlers,
    click() { assert.equal(typeof handlers.click, 'function'); handlers.click(); }
  };
}

test('lobby opens from a direct click in a named, reusable tab', () => {
  const view = createRoom();
  view.click();
  assert.equal(view.opens.length, 1);
  assert.deepEqual(view.opens[0], { url: './', name: 'dartarena-lobby' });
  assert.deepEqual(view.navigations, []);
  assert.deepEqual(view.alerts, []);
});

test('repeated clicks reuse the same named target', () => {
  const view = createRoom();
  view.click();
  view.click();
  assert.equal(view.opens.length, 2);
  assert.equal(view.opens[0].name, 'dartarena-lobby');
  assert.equal(view.opens[1].name, 'dartarena-lobby');
  assert.deepEqual(view.navigations, []);
});

test('popup blocking does not navigate or cancel the current room', () => {
  const view = createRoom({ popupBlocked: true });
  view.click();
  assert.equal(view.opens.length, 1);
  assert.match(view.alerts[0], /blokkerte lobbyfanen/);
  assert.deepEqual(view.navigations, []);
});

test('helper gracefully skips pages without the dedicated button', () => {
  const view = createRoom({ buttonPresent: false });
  assert.equal(Object.keys(view.handlers).length, 0);
  assert.deepEqual(view.opens, []);
});

test('the ordinary waiting room has an independent lobby button and cancel action', () => {
  const html = fs.readFileSync(path.join(root, 'room.html'), 'utf8');
  assert.match(html, /id="openLobbyTabBtn"[^>]*>Åpne lobby i ny fane/);
  assert.match(html, /id="leaveRoomBtn"[^>]*>Avbryt venterom/);
  assert.match(html, /open-lobby-tab\.js\?v=20261013-roomjdc1/);
  const room = fs.readFileSync(path.join(root, 'room.js'), 'utf8');
  assert.match(room, /\$\('leaveRoomBtn'\)\.onclick=async/);
  assert.match(room, /location\.replace\('\.\/'\)/);
  assert.doesNotMatch(script, /leaveRoomBtn|cleanup\(|\.send\(/);
});

test('the JDC online match has a visible lobby button alongside its cancel action', () => {
  const html = fs.readFileSync(path.join(root, 'jdc-match.html'), 'utf8');
  assert.match(html, /id="openLobbyTabBtn"[^>]*>Åpne lobby i ny fane/);
  assert.match(html, /id="cancelMatchBtn"[^>]*>Avbryt kamp/);
  assert.match(html, /id="closeMatchBtn"[^>]*class="outline hidden"/);
  assert.match(html, /open-lobby-tab\.js\?v=20261013-roomjdc1/);
  const jdc = fs.readFileSync(path.join(root, 'jdc-match.js'), 'utf8');
  assert.match(jdc, /\$\('closeMatchBtn'\)\.onclick=goLobby/);
  assert.doesNotMatch(script, /cancelMatchBtn|closeMatchBtn|submit_jdc_match_turn/);
});

test('tournament waiting room remains unchanged', () => {
  const html = fs.readFileSync(path.join(root, 'tournament-match-room.html'), 'utf8');
  assert.doesNotMatch(html, /open-lobby-tab\.js|openLobbyTabBtn/);
  assert.match(html, /id="backBtn"[^>]*>Til turnering/);
});

test('normal active matches keep their own working lobby button', () => {
  const script = fs.readFileSync(path.join(root, 'secure-match-cancel.js'), 'utf8');
  assert.match(script, /window\.open\('\.\/','dartarena-lobby'\)/);
  assert.match(script, /close\.textContent='Åpne lobby i ny fane'/);
});
