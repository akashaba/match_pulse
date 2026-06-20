export interface Matchday {
  id: number;
  name: string;
  number: number;
  divisionId: number;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
  computedStatus: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
  predictionsOpen: boolean;
  startDate: string;
  endDate?: string;
}

export interface CreateMatchdayRequest {
  name: string;
  number: number;
  divisionId: number;
  startDate: string;
}

export interface Team {
  id: number;
  name: string;
  code: string;
  badgePath?: string;
  badgeUrl?: string;
}
