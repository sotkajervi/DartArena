export type GameVariant = 'x01' | 'cricket' | 'half_it' | 'sixty_one' | 'jdc';

export type HalfItMode = 'dartcounter' | 'standard';

export type MatchMode = 'legs' | 'sets';

export type X01Game = 170 | 301 | 501 | 1001;

export interface MatchGameConfig {
  duration_seconds?: number;
  half_it_mode?: HalfItMode;
  ranked?: boolean;
}

export interface MatchFormat {
  variant: GameVariant;
  game: X01Game | 501;
  legs: number;
  mode: MatchMode;
  bestOfSets: number;
  config: MatchGameConfig;
}
