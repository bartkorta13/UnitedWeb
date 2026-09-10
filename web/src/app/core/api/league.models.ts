/** Generated-shape models based on core-service/src/main/resources/league.yaml. */
export interface TeamStanding {
  rank: number;
  teamName: string;
  matchesPlayed: number;
  points: number;
  wins: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  setsRatio: number;
  pointRatio: number;
  form?: string[];
}

export interface MatchItem {
  matchId: string;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  score: string;
  finalScore?: string;
  isFinished: boolean;
  place?: string | null;
  hour?: string | null;
  sets?: string[];
}
export interface TeamStatItem {
  label: string;
  hostValue: string | number;
  awayValue: string | number;
  hostColor: 'green' | 'grey';
  awayColor: 'green' | 'grey';
  hasBar: boolean;
  hostBarPercent: number;
  awayBarPercent: number;
}

export interface SetDetailItem {
  setNumber: number;
  hostScore: number;
  awayScore: number;
  scoreText: string;
  difference: number;
  winner: 'host' | 'away' | 'none';
  unitedWon: boolean;
  hostPercent: number;
  awayPercent: number;
}

export type PlayerPosition = 'SETTER' | 'OUTSIDE' | 'OPPOSITE' | 'MIDDLE' | 'LIBERO' | 'COACH';

export interface PlayerItem {
  id: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  number: number;
  height?: number;
  attackRange?: number;
  age?: number;
  isCaptain?: boolean;
}
