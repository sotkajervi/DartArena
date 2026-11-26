// One diagnostic visit on a single board. Start the next visit at manual removal.
class SeerVisit {
  constructor() {
    this.calibration = null;
    this.seen = new Set();
    this.darts = new Map();
  }

  receive(score, receivedAt) {
    if (!score?.throwId || this.seen.has(score.throwId)) return false;
    const candidates = new Map();
    for (const dart of score.observations) {
      const number = dart.darts;
      if (!Number.isInteger(number) || number < 1 || number > 4) continue;
      if (!candidates.has(number)) candidates.set(number, new Set());
      const hit = SeerVisit.hit(dart);
      if (hit !== null) candidates.get(number).add(hit);
    }
    if (score.calibrationError === true) this.calibration = { state: 'error', receivedAt };
    if (!candidates.size) return score.calibrationError === true;
    this.seen.add(score.throwId);
    for (const [number, hits] of candidates) {
      // Each analysis can include darts already on the board. Replace the slot's
      // observations, keeping the player's correction until the darts are removed.
      const previous = this.darts.get(number);
      const corrected = previous?.corrected ?? null;
      this.darts.set(number, { hits: [...hits], corrected, throwId: score.throwId,
        calibrationError: this.calibration?.state === 'error' || previous?.calibrationError === true });
    }
    return true;
  }

  static hit(dart) {
    const { score, base_score: base, multiplier, dx, dy } = dart;
    if (score === 0) {
      return Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0) ? 'MISS' : null;
    }
    const label = ({ 1: 'S', 2: 'D', 3: 'T' })[multiplier] + String(base);
    return SeerVisit.points.get(label) === score && Number.isInteger(score) ? label : null;
  }

  static selected(dart) {
    if (dart.corrected !== null) return dart.corrected;
    return dart.hits.length === 1 && !dart.calibrationError ? dart.hits[0] : null;
  }

  correct(number, hit) {
    const dart = this.darts.get(number);
    if (!dart || !SeerVisit.points.has(hit)) return false;
    dart.corrected = hit;
    return true;
  }

  get total() {
    let points = 0;
    for (const dart of this.darts.values()) points += SeerVisit.points.get(SeerVisit.selected(dart)) ?? 0;
    return points;
  }
}

SeerVisit.points = new Map([['MISS', 0], ['S25', 25], ['D25', 50]]);
for (const [index, ring] of ['S', 'D', 'T'].entries()) {
  for (let base = 1; base <= 20; base++) SeerVisit.points.set(ring + base, (index + 1) * base);
}

if (typeof module !== 'undefined' && module.exports) module.exports = SeerVisit;
