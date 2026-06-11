export interface Fixture {
  id: number;
  matchdayId: number;
  homeTeam: {
    id: number;
    name: string;
    code?: string;
    badgePath?: string;
    badgeUrl?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    code?: string;
    badgePath?: string;
    badgeUrl?: string;
  };
  homeScore?: number;
  awayScore?: number;
  kickoffAt?: string;
  displayOrder?: number;
  status: 'SCHEDULED' | 'COMPLETED';
}

export interface CreateFixtureRequest {
  matchdayId: number;
  homeTeamId: number;
  awayTeamId: number;
  kickoffAt?: string;
  displayOrder?: number;
}

export interface UpdateResultRequest {
  homeScore: number;
  awayScore: number;
}
