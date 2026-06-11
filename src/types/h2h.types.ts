export interface H2hPlayer {
  id: number;
  username: string;
  profilePhoto?: string;
}

export interface H2hMatchup {
  id: number;
  matchdayId: number;
  matchdayName: string;
  matchdayNumber: number;
  format: 'LEADERBOARD' | 'KNOCKOUT';
  player1: H2hPlayer | null;
  player2: H2hPlayer | null;
  player1Points: number | null;
  player2Points: number | null;
  player1H2hPoints: number | null;
  player2H2hPoints: number | null;
  winnerId: number | null;
  resolved: boolean;
  knockoutRound: string | null;
  bracketPosition: number | null;
}

export interface H2hStanding {
  id: number;
  user: H2hPlayer;
  h2hPoints: number;
  wins: number;
  draws: number;
  losses: number;
  matchupsPlayed: number;
  totalPredictionPoints: number;
}
