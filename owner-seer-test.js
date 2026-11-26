(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const access = $('seerAccess');
  const log = $('seerLog');
  const last = $('seerLast');
  const board = $('seerBoard');
  const connect = $('seerConnect');
  const disconnect = $('seerDisconnect');
  const demo = $('seerDemo');
  const clear = $('seerClear');
  const english = window.DartArenaI18n?.getLanguage() === 'en';
  const tr = (no, en) => english ? en : no;
  const events = [
    'score', 'calibration-successfully', 'calibration-failed',
    'board-calibration-error', 'ping', 'message',
  ];
  let socket = null;
  let owner = false;
  let authCheck = 0;

  document.documentElement.lang = english ? 'en' : 'no';
  $('seerIdLabel').textContent = tr('Skive-ID fra SEER', 'SEER board ID');
  connect.textContent = tr('Koble til', 'Connect');
  disconnect.textContent = tr('Koble fra', 'Disconnect');
  demo.textContent = tr('Vis testdata', 'Show sample data');
  clear.textContent = tr('Tøm logg', 'Clear log');
  $('seerLogTitle').textContent = tr('Hendelseslogg', 'Event log');

  function status(no, en) {
    $('seerStatus').textContent = tr(no, en);
  }

  function resetLog() {
    log.replaceChildren();
    last.textContent = tr('Ingen hendelser ennå.', 'No events yet.');
    clear.disabled = true;
  }

  function setConnected(active) {
    board.disabled = active;
    connect.disabled = active;
    demo.disabled = active;
    disconnect.disabled = !active;
  }

  function stop() {
    const previous = socket;
    socket = null;
    previous?.disconnect();
    setConnected(false);
    status('Frakoblet', 'Disconnected');
  }

  function formatHit(dart) {
    if (dart.dx === 0 && dart.dy === 0 && dart.score === 0) {
      return tr('Ikke detektert', 'Not detected');
    }
    if (dart.base_score === 25 && dart.multiplier === 2) return 'Bull · 50';
    if (dart.base_score === 25) return '25';
    if (dart.score === 0) return tr('Bom · 0', 'Miss · 0');
    const ring = { 1: 'S', 2: 'D', 3: 'T' }[dart.multiplier] || '';
    return `${ring}${dart.base_score} · ${dart.score}`;
  }

  function scoreSummary(payload) {
    if (!Array.isArray(payload)) return '';
    const observations = new Map();
    for (const dart of payload.slice(2)) {
      if (!Number.isInteger(dart?.darts) || !Number.isInteger(dart?.score)) continue;
      if (!observations.has(dart.darts)) observations.set(dart.darts, new Set());
      observations.get(dart.darts).add(formatHit(dart));
    }
    return [...observations.entries()].sort(([a], [b]) => a - b)
      .map(([number, hits]) => `${tr('Pil', 'Dart')} ${number}: ${[...hits].join(' / ')}`)
      .join(' | ');
  }

  function addEvent(name, raw, sample = false) {
    let payload = raw;
    let invalidJson = false;
    if (typeof raw === 'string') {
      try {
        payload = JSON.parse(raw);
      } catch {
        invalidJson = true;
      }
    }
    const time = new Date().toLocaleTimeString(english ? 'en-GB' : 'nb-NO');
    const source = sample ? ` · ${tr('Testdata', 'Sample data')}` : '';
    const summary = document.createElement('summary');
    const hits = name === 'score' ? scoreSummary(payload) : '';
    summary.textContent = [`${time} · ${name}${source}`, hits,
      invalidJson ? tr('Ugyldig JSON', 'Invalid JSON') : ''].filter(Boolean).join(' · ');
    const data = document.createElement('pre');
    data.textContent = (typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) ?? '').slice(0, 32000);
    const details = document.createElement('details');
    details.append(summary, data);
    const item = document.createElement('li');
    item.append(details);
    log.prepend(item);
    if (log.childElementCount > 100) log.lastElementChild.remove();
    clear.disabled = false;
    last.textContent = `${tr('Siste hendelse', 'Last event')}: ${time}${source}`;
  }

  $('seerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!owner || socket) return;
    const boardId = board.value.trim();
    if (!boardId) {
      status('Skriv inn skive-ID.', 'Enter a board ID.');
      board.focus();
      return;
    }
    if (typeof window.io !== 'function') {
      status('Kunne ikke laste Socket.IO. Last inn siden på nytt.', 'Could not load Socket.IO. Reload the page.');
      return;
    }
    resetLog();
    const connection = window.io('https://autoscoring-socket.dartsorakel.com', {
      autoConnect: false,
      forceNew: true,
    });
    socket = connection;
    setConnected(true);
    status('Kobler til …', 'Connecting …');
    connection.on('connect', () => {
      if (socket !== connection) return;
      connection.emit('join', { board_id: boardId });
      status('Tilkoblet. Venter på hendelser fra skiva.', 'Connected. Waiting for board events.');
    });
    connection.on('connect_error', () => {
      if (socket === connection) status('Kunne ikke koble til SEER-serveren.', 'Could not connect to the SEER server.');
    });
    connection.on('disconnect', () => {
      if (socket !== connection) return;
      if (connection.active) status('Forbindelsen brøt. Prøver igjen …', 'Connection lost. Reconnecting …');
      else stop();
    });
    for (const name of events) {
      connection.on(name, (raw) => {
        if (socket === connection) addEvent(name, raw);
      });
    }
    connection.connect();
  });

  demo.addEventListener('click', () => {
    if (!owner || socket) return;
    resetLog();
    const dart = { darts: 1, dx: 842, dy: 513, score: 60, multiplier: 3, base_score: 20 };
    addEvent('score', JSON.stringify([
      { id: 'demo-1' },
      { calibration_id: 'demo-calibration' },
      { ...dart, Cam: 0 },
      { ...dart, Cam: 1 },
      { Cam: 0, darts: 2, dx: 0, dy: 0, score: 0 },
    ]), true);
  });

  disconnect.addEventListener('click', stop);
  clear.addEventListener('click', resetLog);
  window.addEventListener('pagehide', stop);
  resetLog();
  stop();

  const db = window.supabase?.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',
  );

  function applyAccess(allowed, message) {
    owner = allowed;
    $('seerTest').hidden = !allowed;
    $('seerEvents').hidden = !allowed;
    access.hidden = allowed;
    access.textContent = message;
    if (!allowed) {
      stop();
      board.value = '';
      resetLog();
    }
  }

  async function checkAccess() {
    const ticket = ++authCheck;
    try {
      const { data, error } = await db.auth.getUser();
      if (ticket !== authCheck) return;
      if (error || !data?.user) {
        applyAccess(false, tr('Logg inn med Owner-kontoen.', 'Sign in with an Owner account.'));
        return;
      }
      const role = await db.rpc('is_owner');
      if (ticket !== authCheck) return;
      if (role.error) throw role.error;
      applyAccess(role.data === true, tr('Tilgang krever Owner.', 'Owner access is required.'));
    } catch {
      if (ticket === authCheck) {
        applyAccess(false, tr('Kunne ikke kontrollere Owner-tilgang.', 'Could not verify Owner access.'));
      }
    }
  }

  if (db) {
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        authCheck++;
        applyAccess(false, tr('Logg inn med Owner-kontoen.', 'Sign in with an Owner account.'));
      }
    });
  }
  checkAccess();
})();
