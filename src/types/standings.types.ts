export interface LeagueStanding {
  id: number;
  league: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    username: string;
    profilePhoto?: string;
  };
  totalPoints: number;
  matchdaysPlayed: number;
  correctScores: number;
  correctOutcomes: number;
  lastMatchdayPoints: number;
  lastMatchdayId?: number;
  form?: Array<{
    matchdayId: number;
    label: string;
    points: number;
    tone: 'winner' | 'hot' | 'steady' | 'cold';
  }>;
  badges?: Array<{
    key: string;
    label: string;
  }>;
  streaks?: {
    outcome: number;
    exact: number;
    bestOutcome: number;
    bestExact: number;
    jokerHits?: number;
  };
  weeklyWins?: number;
}

export interface LeagueInsights {
  league: {
    id: number;
    name: string;
    code: string;
  } | null;
  pressure: {
    message: string;
    rank: number | null;
    pointsBehind: number;
    targetUser?: {
      id: number;
      username: string;
      profilePhoto?: string;
    } | null;
  };
  weeklyWinners: Array<{
    matchdayId: number;
    matchdayName: string;
    matchdayNumber: number;
    points: number;
    winners: Array<{
      id: number;
      username: string;
      profilePhoto?: string;
    }>;
  }>;
  byUser: Record<string, {
    form: LeagueStanding['form'];
    badges: LeagueStanding['badges'];
    streaks: NonNullable<LeagueStanding['streaks']>;
    weeklyWins: number;
  }>;
  activity: Array<{
    id?: number;
    type: 'prediction' | 'results' | 'weekly_winner' | 'member_joined' | 'league_created' | 'fixtures' | string;
    at: string;
    message: string;
    user?: {
      id: number;
      username: string;
      profilePhoto?: string;
    };
    count?: number;
    matchdayName?: string;
    matchdayId?: number;
    fixtureId?: number;
    metadata?: Record<string, unknown>;
  }>;
  shareCard: {
    title: string;
    topThree: Array<{
      rank: number;
      user: {
        id: number;
        username: string;
        profilePhoto?: string;
      } | null;
      points: number;
    }>;
    currentUser: {
      rank: number;
      user: {
        id: number;
        username: string;
        profilePhoto?: string;
      } | null;
      points: number;
    } | null;
  };
}
