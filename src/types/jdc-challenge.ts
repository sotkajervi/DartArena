export type JdcBadge = 'white' | 'purple' | 'yellow' | 'green' | 'blue' | 'red' | 'black' | 'gold';

export type JdcShanghaiHit = 'M' | 'S' | 'D' | 'T';
export type JdcDoubleHit = 'M' | 'H';

export interface JdcChallengeResult {
  score: number;
  phase1Score: number;
  doublesScore: number;
  phase3Score: number;
  doublesHit: number;
  shanghaiCount: number;
  badge: JdcBadge;
}
