(function () {
  'use strict';
  const E = window.DartArenaRacingEngine;
  if (!E) return;
  const $ = function (id) { return document.getElementById(id); };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const countSelect = $('driverCount');
  const driverFields = $('driverFields');
  const setupPanel = $('setupPanel');
  const gamePanel = $('gamePanel');
  const track = $('trackCenterline');
  const carsLayer = $('carsLayer');
  const numberGrid = $('numberGrid');
  const finishOverlay = $('finishOverlay');
  const colors = E.COLORS;
  let race = null;
  let history = [];
  let multiplier = 1;
  let botBusy = false;
  let raceToken = 0;
  let feedback = 'Velg et felt for å starte.';
  let finishDismissed = false;

  function el(tag, className, textValue) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  }

  function svgEl(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    return node;
  }

  function makeFields() {
    const previous = Array.from(driverFields.querySelectorAll('.racing-driver-field')).map(function (row) {
      return {
        name: row.querySelector('input').value,
        bot: row.querySelector('select').value === 'bot'
      };
    });
    const number = Number(countSelect.value);
    driverFields.replaceChildren();
    for (let i = 0; i < number; i++) {
      const row = el('div', 'racing-driver-field');
      const color = el('span', 'racing-color-dot');
      color.style.backgroundColor = colors[i];
      color.style.color = colors[i];

      const nameLabel = el('label', '', 'FØRER ' + (i + 1));
      const input = el('input');
      input.type = 'text';
      input.maxLength = 26;
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Navn på fører ' + (i + 1));
      input.value = previous[i] ? previous[i].name : (i === 0 ? 'Spiller 1' : (i === 1 ? 'DartBot' : 'Spiller ' + (i + 1)));
      nameLabel.appendChild(input);

      const typeLabel = el('label', '', 'TYPE');
      const select = el('select');
      select.setAttribute('aria-label', 'Type fører ' + (i + 1));
      const human = el('option', '', 'Spiller');
      human.value = 'human';
      const bot = el('option', '', 'Bot');
      bot.value = 'bot';
      select.append(human, bot);
      select.value = i === 0 ? 'human' : (previous[i] ? (previous[i].bot ? 'bot' : 'human') : (i === 1 ? 'bot' : 'human'));
      if (i === 0) { select.disabled = true; }
      typeLabel.appendChild(select);
      row.append(color, nameLabel, typeLabel);
      driverFields.appendChild(row);
    }
  }

  function makeKeyboard() {
    numberGrid.replaceChildren();
    for (let i = 20; i >= 1; i--) {
      const button = el('button', '', i);
      button.type = 'button';
      button.dataset.number = String(i);
      button.addEventListener('click', function () { addThrow(i, multiplier); });
      numberGrid.appendChild(button);
    }
    $('bull25').addEventListener('click', function () { addThrow(25, 1); });
    $('bull50').addEventListener('click', function () { addThrow(25, 2); });
    $('missDart').addEventListener('click', function () { addThrow(0, 1); });
    $('multiplierButtons').querySelectorAll('[data-mult]').forEach(function (button) {
      button.addEventListener('click', function () {
        multiplier = Number(button.dataset.mult);
        renderMultipliers();
      });
    });
  }

  function renderMultipliers() {
    $('multiplierButtons').querySelectorAll('[data-mult]').forEach(function (button) {
      const selected = Number(button.dataset.mult) === multiplier;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function makeCars() {
    carsLayer.replaceChildren();
    race.players.forEach(function (player) {
      const group = svgEl('g', { class: 'racing-car', id: 'raceCar' + player.id });
      const back = svgEl('rect', { x: -26, y: -15, width: 52, height: 30, rx: 8, fill: '#06141b', stroke: '#03121a', 'stroke-width': 4 });
      const body = svgEl('rect', { x: -23, y: -13, width: 46, height: 26, rx: 7, fill: player.color, stroke: '#ffffff', 'stroke-opacity': '.5', 'stroke-width': 1.5 });
      const windshield = svgEl('path', { d: 'M-7 -10 L9 -8 L9 8 L-7 10 Z', fill: '#103443', stroke: '#f5ffff', 'stroke-opacity': '.8' });
      const hood = svgEl('path', { d: 'M17 -10 L25 -7 L25 7 L17 10 Z', fill: '#ffffff', 'fill-opacity': '.55' });
      const tail = svgEl('rect', { x: -27, y: -17, width: 6, height: 34, rx: 3, fill: '#10181e' });
      const numeral = svgEl('text', { x: -16, y: 5, fill: '#061720', 'font-size': 12, 'font-weight': 950, 'text-anchor': 'middle' });
      numeral.textContent = String(player.id + 1);
      group.append(back, body, windshield, hood, tail, numeral);
      carsLayer.appendChild(group);
    });
    positionCars();
  }

  function positionCars() {
    if (!race || !track) return;
    let length;
    try { length = track.getTotalLength(); } catch (_) { return; }
    if (!length) return;
    race.players.forEach(function (player, i) {
      const node = $('raceCar' + player.id);
      if (!node) return;
      const fraction = (player.progress % E.LAP) / E.LAP;
      const s = Math.min(length - 0.01, fraction * length);
      const pt = track.getPointAtLength(s);
      const ahead = track.getPointAtLength(Math.min(length, s + 2.5));
      const behind = track.getPointAtLength(Math.max(0, s - 2.5));
      let dx = ahead.x - behind.x;
      let dy = ahead.y - behind.y;
      const mag = Math.hypot(dx, dy) || 1;
      dx /= mag;
      dy /= mag;
      const offset = (i - (race.players.length - 1) / 2) * 25;
      const x = pt.x - dy * offset;
      const y = pt.y + dx * offset;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      node.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') rotate(' + angle.toFixed(2) + ')');
      const focused = player.id === race.active && !race.finished;
      node.setAttribute('opacity', focused ? '1' : '.9');
    });
  }

  function standingRow(player, rank) {
    const row = el('div', 'racing-standing' + (player.id === race.active && !race.finished ? ' active' : ''));
    const rankNode = el('span', 'racing-rank', String(rank + 1).padStart(2, '0'));
    const playerInfo = el('div', 'racing-player');
    const dot = el('i', 'racing-player-bullet');
    dot.style.background = player.color;
    const nameWrap = el('div');
    const name = el('strong', '', player.name);
    const lap = el('small', '', player.progress >= race.goal ? 'MÅL' : ('Runde ' + (Math.floor(player.progress / E.LAP) + 1) + ' av ' + race.laps));
    nameWrap.append(name, lap);
    playerInfo.append(dot, nameWrap);
    const progress = el('div', 'racing-progress');
    const fill = el('div', 'racing-progress-fill');
    fill.style.width = Math.min(100, (player.progress / race.goal) * 100).toFixed(1) + '%';
    fill.style.background = player.color;
    progress.appendChild(fill);
    const distance = el('span', 'racing-distance', player.progress + ' m');
    row.append(rankNode, playerInfo, progress, distance);
    return row;
  }

  function renderLeaderboard() {
    $('leaderboard').replaceChildren();
    E.ranking(race).forEach(function (player, index) {
      $('leaderboard').appendChild(standingRow(player, index));
    });
  }

  function renderSlots() {
    const current = race.moves.filter(function (move) { return move.player === race.active && move.round === race.round; });
    const slots = $('throwSlots').children;
    for (let i = 0; i < 3; i++) {
      slots[i].textContent = current[i] ? E.formatHit(current[i].number, current[i].multiplier) : '–';
      slots[i].classList.toggle('empty', !current[i]);
      slots[i].title = current[i] ? ('+' + current[i].gain + ' m') : '';
    }
  }

  function renderLog() {
    const wrap = $('lastThrows');
    wrap.replaceChildren();
    const recent = race.moves.slice(-10).reverse();
    if (!recent.length) {
      wrap.appendChild(el('span', 'racing-kicker', 'Ingen kast registrert ennå.'));
      return;
    }
    recent.forEach(function (move) {
      const item = el('div', 'racing-log-item');
      const who = el('b', '', race.players[move.player].name + ': ');
      const what = document.createTextNode(E.formatHit(move.number, move.multiplier) + ' · +' + move.gain + ' m');
      item.append(who, what);
      wrap.appendChild(item);
    });
  }

  function renderZone() {
    const player = race.players[race.active];
    const zone = E.zoneFor(player.progress);
    const card = $('zoneCard');
    card.classList.toggle('corner', zone.kind === 'corner');
    if (zone.kind === 'corner') {
      $('zoneHeading').textContent = 'SVING ' + zone.number + ' · PRESISJON';
      $('zoneTitle').textContent = 'Sikt på tallet ' + zone.target;
      $('zoneDescription').textContent = 'Riktig tall gir +24 m ekstra. Andre tall gir bare 48 % av poengsummen.';
    } else {
      $('zoneHeading').textContent = 'RETTSTREKKE · FULL FART';
      $('zoneTitle').textContent = 'Kast høyest mulig!';
      $('zoneDescription').textContent = 'Hele poengsummen flytter bilen. For eksempel gir T20 +60 m.';
    }
    numberGrid.querySelectorAll('button').forEach(function (button) {
      button.classList.toggle('target', zone.kind === 'corner' && Number(button.dataset.number) === zone.target);
    });
  }

  function controlsDisabled(disabled) {
    document.querySelectorAll('#numberGrid button,#bull25,#bull50,#missDart,#multiplierButtons button').forEach(function (button) {
      button.disabled = Boolean(disabled);
    });
  }

  function render() {
    if (!race) return;
    const player = race.players[race.active];
    const isBot = player.bot;
    $('raceStage').textContent = 'KASTERUNDE ' + race.round;
    $('raceLaps').textContent = race.laps + (race.laps === 1 ? ' RUNDE' : ' RUNDER');
    $('trackInfo').textContent = (Math.min(race.laps, Math.floor(player.progress / E.LAP) + 1)) + ' / ' + race.laps + ' RUNDER';
    $('dartCountBadge').textContent = race.dart < 3 ? ('PIL ' + (race.dart + 1) + ' AV 3') : '3 AV 3 PILER';
    $('activeName').textContent = player.name;
    $('activeCar').style.borderColor = player.color;
    $('activeCar').style.background = player.color + '25';
    $('activePosition').textContent = 'P' + (E.ranking(race).findIndex(function (p) { return p.id === player.id; }) + 1);
    $('manualControls').hidden = isBot;
    $('botControls').hidden = !isBot;
    $('botTurn').disabled = botBusy || race.dart > 0 || race.finished;
    $('nextDriver').disabled = botBusy || race.dart < 3 || race.finished;
    $('nextDriver').textContent = race.active === race.players.length - 1 ? 'FULLFØR KASTERUNDE →' : 'NESTE FØRER →';
    $('undoThrow').disabled = botBusy || history.length === 0;
    $('resetRace').disabled = botBusy;
    controlsDisabled(botBusy || isBot || race.dart >= 3 || race.finished);
    renderSlots();
    renderZone();
    renderMultipliers();
    renderLeaderboard();
    renderLog();
    positionCars();
    $('throwFeedback').textContent = feedback;
    $('liveCallout').textContent = race.lastMove
      ? (E.formatHit(race.lastMove.number, race.lastMove.multiplier) + '  →  +' + race.lastMove.gain + ' M')
      : (race.finished ? 'MÅLGANG!' : (player.name.toUpperCase() + ' ER KLAR'));
    $('raceStatus')?.setAttribute('data-state', race.finished ? 'finished' : 'live');
    if (!race.finished) finishOverlay.hidden = true;
  }

  function snapshot() {
    history.push(JSON.parse(JSON.stringify(race)));
    if (history.length > 200) history.shift();
  }

  function announceMove(move) {
    feedback = E.formatHit(move.number, move.multiplier) + ' → +' + move.gain + ' m'
      + (move.bonus ? ' (inkl. +24 m svingbonus)' : '')
      + (move.zone.kind === 'corner' && !move.bonus ? ' · feil tall i svingen' : '');
    if (race.dart === 3) feedback += ' · Klar for neste fører.';
  }

  function addThrow(number, mult) {
    if (!race || race.finished || botBusy || race.players[race.active].bot || race.dart >= 3) return;
    try {
      snapshot();
      race = E.throwDart(race, { number: number, multiplier: mult });
      announceMove(race.lastMove);
      render();
    } catch (error) {
      history.pop();
      feedback = error.message;
      render();
    }
  }

  function nextDriver() {
    if (!race || race.finished || botBusy || race.dart !== 3) return;
    try {
      snapshot();
      race = E.nextTurn(race);
      feedback = race.finished ? 'Løpet er avgjort!' : 'Registrer tre piler for ' + race.players[race.active].name + '.';
      render();
      if (race.finished) showFinish();
    } catch (error) {
      history.pop();
      feedback = error.message;
      render();
    }
  }

  function showFinish() {
    finishDismissed = false;
    const winners = race.players.filter(function (p) { return race.winners.includes(p.id); });
    $('winnerHeading').textContent = winners.length > 1 ? 'DELT SEIER!' : (winners[0].name + ' VINNER!');
    $('winnerDescription').textContent = 'Løpet er over etter ' + race.round + ' kasterunder. Alle førerne fikk like mange piler.';
    const rank = $('winnerRanking');
    rank.replaceChildren();
    E.ranking(race).forEach(function (p, i) {
      const row = el('div');
      const who = el('span', '', (i + 1) + '. ' + p.name);
      const metres = el('strong', '', p.progress + ' m');
      row.append(who, metres);
      rank.appendChild(row);
    });
    finishOverlay.hidden = false;
  }

  function undo() {
    if (!history.length || botBusy) return;
    race = history.pop();
    feedback = 'Siste handling angret.';
    finishOverlay.hidden = true;
    render();
  }

  function reset() {
    raceToken++;
    botBusy = false;
    race = null;
    history = [];
    feedback = 'Velg et felt for å starte.';
    finishOverlay.hidden = true;
    gamePanel.hidden = true;
    setupPanel.hidden = false;
    setupPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function start() {
    const rows = Array.from(driverFields.querySelectorAll('.racing-driver-field'));
    const players = rows.map(function (row, i) {
      return {
        name: row.querySelector('input').value.trim() || ('Fører ' + (i + 1)),
        bot: row.querySelector('select').value === 'bot'
      };
    });
    try {
      race = E.createRace({ players: players, laps: Number($('lapCount').value) });
    } catch (error) {
      $('setupError').textContent = error.message;
      return;
    }
    $('setupError').textContent = '';
    raceToken++;
    history = [];
    multiplier = 1;
    botBusy = false;
    finishDismissed = false;
    feedback = 'Løpet er i gang! ' + race.players[0].name + ' kaster først.';
    setupPanel.hidden = true;
    gamePanel.hidden = false;
    makeCars();
    render();
    gamePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runBot() {
    if (!race || race.finished || botBusy || !race.players[race.active].bot || race.dart !== 0) return;
    const token = raceToken;
    botBusy = true;
    snapshot();
    feedback = race.players[race.active].name + ' gjør seg klar…';
    render();
    for (let i = 0; i < 3; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, 470); });
      if (token !== raceToken || !race) return;
      const hit = E.botThrow(race);
      race = E.throwDart(race, hit);
      announceMove(race.lastMove);
      render();
    }
    botBusy = false;
    render();
  }

  countSelect.addEventListener('change', makeFields);
  $('startRace').addEventListener('click', start);
  $('nextDriver').addEventListener('click', nextDriver);
  $('undoThrow').addEventListener('click', undo);
  $('resetRace').addEventListener('click', reset);
  $('botTurn').addEventListener('click', runBot);
  $('closeFinish').addEventListener('click', function () {
    finishDismissed = true;
    finishOverlay.hidden = true;
  });
  $('newAfterFinish').addEventListener('click', reset);
  makeFields();
  makeKeyboard();
  renderMultipliers();
})();
