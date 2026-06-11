export interface League {
  id: number;
  name: string;
  code: string;
  division: {
    id: number;
    name: string;
    code: string;
    logoPath?: string;
    logoUrl?: string;
  };
  createdBy: {
    id: number;
    username: string;
  };
  members: Array<{
    id: number;
    username: string;
    email?: string;
    profilePhoto?: string;
    isGuest?: boolean;
  }>;
  overallStandingsEnabled: boolean;
  h2hLeaderboardEnabled: boolean;
  h2hKnockoutEnabled: boolean;
}

export interface CreateLeagueRequest {
  name: string;
  divisionId: number;
  code?: string;
  overallStandingsEnabled?: boolean;
  h2hLeaderboardEnabled?: boolean;
  h2hKnockoutEnabled?: boolean;
}

export interface JoinLeagueRequest {
  code: string;
}

export interface Division {
  id: number;
  name: string;
  code: string;
  logoPath?: string;
  logoUrl?: string;
}

export interface Sport {
  id: number;
  name: string;
  code: string;
}

export interface Team {
  id: number;
  name: string;
  code: string;
  badgePath?: string;
  badgeUrl?: string;
  division?: Division;
}
