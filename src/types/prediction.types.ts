export interface Prediction {
  id: number;
  fixtureId: number;
  userId: number;
  leagueId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points?: number;
  isJoker?: boolean;
  user?: {
    id: number;
    username: string;
    profilePhoto?: string;
    isGuest?: boolean;
  };
  createdAt: string;
  updatedAt?: string;
  // Additional display fields
  homeTeamName?: string;
  awayTeamName?: string;
  actualHomeScore?: number;
  actualAwayScore?: number;
  fixtureStatus?: string;
}

export interface PredictionRequest {
  fixtureId: number;
  leagueId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  isJoker?: boolean;
}
