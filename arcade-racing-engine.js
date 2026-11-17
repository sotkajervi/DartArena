/* DartArena Arcade Racing v1 - standalone local game logic. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DartArenaRacingEngine = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const LAP = 420;
  const MAX_DARTS = 3;
  const COLORS = ['#12e5e6', '#ff6179', '#ffc65a', '#9c8cff'];
  const CORNERS = [
    { from: 0.15, to: 0.36, targets: [16, 18, 14] },
    { from: 0.65, to: 0.86, targets: [19, 17, 12] }
  ];

  function zoneFor(progress) {
    const completed = Math.floor(Math.max(0, progress) / LAP);
    const fraction = (Math.max(0, progress) % LAP) / LAP;
    for (let i = 0; i < CORNERS.length; i++) {
      const corner = CORNERS[i];
      if (fraction >= corner.from && fraction < corner.to) {
        return { kind: 'corner', number: i + 1, target: corner.targets[completed % corner.targets.length] };
      }
    }
    return { kind: 'straight', number: 0, target: null };
  }

  function createRace(options) {
    const laps = Number(options && options.laps);
    const players = options && options.players;
    if (!Number.isInteger(laps) || laps < 1 || laps > 3) throw new Error('Velg 1, 2 eller 3 runder.');
    if (!Array.isArray(players) || players.length < 2 || players.length > 4) throw new Error('Velg 2–4 førere.');
    return {
      laps: laps, goal: laps * LAP, round: 1, active: 0, dart: 0,
      finished: false, winners: [], moves: [], lastMove: null,
      players: players.map(function (item, index) {
        return {
          id: index, name: String(item.name || ('Fører ' + (index + 1))).trim().slice(0, 26) || ('Fører ' + (index + 1)),
          bot: Boolean(item.bot), color: COLORS[index], progress: 0, darts: 0
        };
      })
    };
  }

  function normalizeThrow(input) {
    const number = Number(input && input.number);
    const multiplier = Number(input && input.multiplier);
    const goodNumber = Number.isInteger(number) && (number === 0 || number === 25 || (number >= 1 && number <= 20));
    const goodMultiplier = Number.isInteger(multiplier) && multiplier >= 1 && multiplier <= 3;
    if (!goodNumber || !goodMultiplier || (number === 25 && multiplier === 3) || (number === 0 && multiplier !== 1)) {
      throw new Error('Ugyldig darttreff.');
    }
    return { number: number, multiplier: multiplier };
  }

  function pointsFor(number, multiplier) {
    return number * multiplier;
  }

  function throwDart(state, input) {
    if (!state || state.finished || state.dart >= MAX_DARTS) throw new Error('Ingen nye kast i denne turen.');
    const hit = normalizeThrow(input);
    const player = state.players[state.active];
    const zone = zoneFor(player.progress);
    const score = pointsFor(hit.number, hit.multiplier);
    let gain = score;
    let bonus = 0;
    if (zone.kind === 'corner') {
      if (hit.number === zone.target) {
        bonus = 24;
        gain += bonus;
      } else {
        gain = Math.floor(score * 0.48);
      }
    }
    const next = {
      ...state, dart: state.dart + 1,
      players: state.players.map(function (p, i) {
        return i === state.active ? { ...p, progress: p.progress + gain, darts: p.darts + 1 } : p;
      })
    };
    const move = {
      player: state.active, number: hit.number, multiplier: hit.multiplier,
      score: score, gain: gain, bonus: bonus, zone: zone,
      before: player.progress, after: player.progress + gain, round: state.round,
      dart: state.dart + 1
    };
    next.lastMove = move;
    next.moves = state.moves.concat([move]);
    return next;
  }

  function nextTurn(state) {
    if (!state || state.finished || state.dart !== MAX_DARTS) throw new Error('Alle tre piler må registreres først.');
    const isLast = state.active === state.players.length - 1;
    if (isLast && state.players.some(function (p) { return p.progress >= state.goal; })) {
      const best = Math.max.apply(null, state.players.map(function (p) { return p.progress; }));
      return { ...state, finished: true, winners: state.players.filter(function (p) { return p.progress === best; }).map(function (p) { return p.id; }) };
    }
    return { ...state, active: isLast ? 0 : state.active + 1, dart: 0, round: state.round + (isLast ? 1 : 0), lastMove: null };
  }

  function botThrow(state, random) {
    const rng = typeof random === 'function' ? random : Math.random;
    const zone = zoneFor(state.players[state.active].progress);
    if (rng() < 0.11) return { number: 0, multiplier: 1 };
    let number;
    if (zone.kind === 'corner' && rng() < 0.68) number = zone.target;
    else {
      const targets = [20, 20, 20, 19, 18, 17, 5, 1, 12];
      number = targets[Math.min(targets.length - 1, Math.floor(rng() * targets.length))];
    }
    const roll = rng();
    const multiplier = roll < 0.17 ? 3 : (roll < 0.34 ? 2 : 1);
    return { number: number, multiplier: multiplier };
  }

  function ranking(state) {
    return state.players.map(function (p) { return p; }).sort(function (a, b) {
      return b.progress - a.progress || a.id - b.id;
    });
  }

  function formatHit(number, multiplier) {
    if (number === 0) return 'BOM';
    if (number === 25) return multiplier === 2 ? 'BULL 50' : 'BULL 25';
    return (multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S') + number;
  }

  return Object.freeze({ LAP: LAP, MAX_DARTS: MAX_DARTS, COLORS: COLORS,
    zoneFor: zoneFor, createRace: createRace, normalizeThrow: normalizeThrow,
    pointsFor: pointsFor, throwDart: throwDart, nextTurn: nextTurn,
    botThrow: botThrow, ranking: ranking, formatHit: formatHit });
});
