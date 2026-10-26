/* DartArena Cricket: overlay cumulative marks in one fixed symbol.
 * A target closed in one visit gets only a circle.
 * Previous one mark: slash inside circle; previous two marks: X inside circle.
 * This is presentation only: numeric scores and MPR stay unchanged.
 */
(function (root) {
  'use strict';

  const normalizeTarget = value => {
    const target = String(value ?? '').toUpperCase();
    return target === 'BULL' ? 'B' : target;
  };

  const countKind = n => n >= 3 ? 'circle' : n === 2 ? 'cross' : n === 1 ? 'slash' : 'empty';

  // Supports both the named-config calls used by tests and positional calls in UI.
  function kind(visits, player, target, current) {
    const cfg = player && typeof player === 'object' ? player : null;
    const wantedPlayer = cfg ? cfg.player : player;
    const wantedTarget = normalizeTarget(cfg ? cfg.target : target);
    const wantedLeg = cfg?.leg;
    const wantedStage = cfg?.stage;
    const expected = Math.max(0, Math.min(3, Number(cfg ? cfg.fallback : current) || 0));
    if (!expected) return 'empty';

    let total = 0;
    let beforeClosure = 0;

    for (const visit of Array.isArray(visits) ? visits : []) {
      if (String(visit?.player ?? visit?.player_id) !== String(wantedPlayer)) continue;
      if (wantedLeg !== undefined && Number(visit?.leg ?? visit?.leg_no) !== Number(wantedLeg)) continue;
      if (wantedStage !== undefined && Number(visit?.stage) !== Number(wantedStage)) continue;

      let marksThisVisit = 0;
      for (const dart of Array.isArray(visit?.darts) ? visit.darts : []) {
        if (normalizeTarget(dart?.target) !== wantedTarget) continue;
        const marks = Math.max(0, Math.min(3, Number(dart?.mult) || 0));
        marksThisVisit += Math.min(marks, Math.max(0, 3 - total - marksThisVisit));
      }
      if (!marksThisVisit) continue;
      const beforeVisit = total;
      total += marksThisVisit;
      if (total >= 3) {
        beforeClosure = beforeVisit;
        break;
      }
    }

    // During realtime sync or after a leg changes, the visit log can lag.
    // Fall back to the confirmed numeric marks rather than invent visit history.
    if (total !== expected) return countKind(expected);
    if (total < 3) return countKind(total);
    if (beforeClosure === 1) return 'slash-circle';
    if (beforeClosure === 2) return 'cross-circle';
    return 'circle';
  }

  const svgPart = {
    circle: '<circle cx="20" cy="20" r="14.7"/>',
    slash: '<line x1="11.5" y1="28.5" x2="28.5" y2="11.5"/>',
    backslash: '<line x1="11.5" y1="11.5" x2="28.5" y2="28.5"/>'
  };

  function render(symbol) {
    if (symbol === 'empty') return '–';
    const hasCircle = symbol.includes('circle');
    const hasSlash = symbol === 'slash' || symbol === 'cross' || symbol === 'slash-circle' || symbol === 'cross-circle';
    const hasBackslash = symbol === 'cross' || symbol === 'cross-circle';
    const shapes = (hasCircle ? svgPart.circle : '')
      + (hasSlash ? svgPart.slash : '')
      + (hasBackslash ? svgPart.backslash : '');
    return '<svg class="da-cricket-symbol" width="32" height="32" viewBox="0 0 40 40" '
      + 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" '
      + 'stroke-linejoin="round" aria-hidden="true" focusable="false" '
      + 'data-mark-kind="' + symbol + '">' + shapes + '</svg>';
  }

  function display(visits, player, target, current) {
    return render(kind(visits, player, target, current));
  }
  function basic(value) {
    return render(countKind(Math.max(0, Math.min(3, Number(value) || 0))));
  }

  const api = Object.freeze({ kind, display, basic, render });
  root.DartArenaCricketMarkHistory = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
