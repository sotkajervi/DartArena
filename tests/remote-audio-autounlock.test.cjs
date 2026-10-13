'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'remote-audio-autounlock.js'), 'utf8');

function classList(initial = []) {
  const names = new Set(initial);
  return {
    add(name) { names.add(name); },
    remove(name) { names.delete(name); },
    contains(name) { return names.has(name); }
  };
}

function setup({ overlay = true, audio = true, blocked = false } = {}) {
  let interval = null;
  let playbackCalls = 0;
  const buttonHandlers = {};
  const track = { readyState: 'live', enabled: true, muted: false };

  class MockMediaStream {
    constructor(hasAudio = true) { this.hasAudio = hasAudio; }
    getAudioTracks() { return this.hasAudio ? [track] : []; }
  }

  const button = {
    classList: classList(['hidden']),
    textContent: '',
    addEventListener(name, handler) { buttonHandlers[name] = handler; }
  };
  const overlayNode = overlay ? { classList: classList(['hidden']) } : null;
  const video = {
    srcObject: new MockMediaStream(audio),
    muted: true,
    addEventListener() {},
    async play() {
      playbackCalls++;
      if (blocked) {
        const error = new Error('Autoplay was blocked');
        error.name = 'NotAllowedError';
        throw error;
      }
    }
  };

  const context = {
    window: { addEventListener() {} },
    document: {
      getElementById(id) {
        return { remoteVideo: video, remoteAudioBtn: button, remoteAudioOverlay: overlayNode }[id] ?? null;
      },
      addEventListener() {}
    },
    MediaStream: MockMediaStream,
    setInterval(fn) { interval = fn; return 1; },
    clearInterval() {},
    console,
    Date
  };

  vm.runInNewContext(source, context);
  return {
    video,
    button,
    overlay: overlayNode,
    tick() { interval?.(); },
    async click() {
      assert.equal(typeof buttonHandlers.click, 'function');
      buttonHandlers.click({ preventDefault() {}, stopImmediatePropagation() {} });
      await settle();
    },
    setBlocked(value) { blocked = value; },
    setStream(hasAudio) { video.srcObject = new MockMediaStream(hasAudio); },
    get playbackCalls() { return playbackCalls; },
    get timerStarted() { return interval !== null; }
  };
}

async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

test('waiting room starts remote audio automatically with the overlay present', async () => {
  const app = setup({ overlay: true });
  await settle();
  assert.equal(app.timerStarted, true);
  assert.equal(app.video.muted, false);
  assert.equal(app.button.classList.contains('hidden'), true);
  assert.equal(app.overlay.classList.contains('hidden'), true);
  assert.equal(app.playbackCalls, 1);
});

test('match room starts remote audio even though there is no overlay', async () => {
  const app = setup({ overlay: false });
  await settle();
  assert.equal(app.timerStarted, true);
  assert.equal(app.video.muted, false);
  assert.equal(app.button.classList.contains('hidden'), true);
  assert.equal(app.playbackCalls, 1);
});

test('match room displays fallback on autoplay denial and click unlocks sound', async () => {
  const app = setup({ overlay: false, blocked: true });
  await settle();
  assert.equal(app.video.muted, true);
  assert.equal(app.button.classList.contains('hidden'), false);
  assert.match(app.button.textContent, /SLÅ PÅ LYD/);

  app.setBlocked(false);
  await app.click();
  assert.equal(app.video.muted, false);
  assert.equal(app.button.classList.contains('hidden'), true);
});

test('waiting room displays its overlay only if autoplay is blocked', async () => {
  const app = setup({ overlay: true, blocked: true });
  await settle();
  assert.equal(app.overlay.classList.contains('hidden'), false);
  assert.equal(app.button.classList.contains('hidden'), false);
  app.setBlocked(false);
  await app.click();
  assert.equal(app.overlay.classList.contains('hidden'), true);
  assert.equal(app.button.classList.contains('hidden'), true);
});

test('no remote audio track does not reveal a misleading sound button', async () => {
  const app = setup({ overlay: false, audio: false });
  await settle();
  assert.equal(app.playbackCalls, 0);
  assert.equal(app.button.classList.contains('hidden'), true);
  app.setStream(true);
  app.tick();
  await settle();
  assert.equal(app.playbackCalls, 1);
  assert.equal(app.video.muted, false);
});
