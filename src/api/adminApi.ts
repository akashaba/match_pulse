import axiosInstance from './axiosConfig';
import { Matchday } from '../types/matchday.types';
import { Fixture } from '../types/fixture.types';
import { Division, Team, Sport, League } from '../types/league.types';
import { Prediction } from '../types/prediction.types';
import { UserProfile } from './superAdminApi';

export interface CreateMatchdayRequest {
  name: string;
  number: number;
  divisionId: number;
  startDate: string;
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

export interface CreateDivisionRequest {
  name: string;
  code: string;
  sportId: number;
  logoPath?: string;
  logoUrl?: string;
}

export interface CreateTeamRequest {
  name: string;
  code: string;
  divisionId: number;
  badgePath?: string;
  badgeUrl?: string;
}

export interface UploadAssetResponse {
  path: string;
  publicUrl: string;
}

export interface AddLeagueMemberRequest {
  userId?: number;
  displayName?: string;
  email?: string;
}

export interface AdminPredictionInput {
  fixtureId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  isJoker?: boolean;
}

export const adminApi = {
  // Sports
  getAllSports: async (): Promise<Sport[]> => {
    const response = await axiosInstance.get('/api/sports');
    return response.data;
  },

  // Leagues and members
  getAllLeagues: async (): Promise<League[]> => {
    const response = await axiosInstance.get('/api/admin/leagues');
    return response.data;
  },

  getUsers: async (search?: string): Promise<UserProfile[]> => {
    const response = await axiosInstance.get('/api/admin/users', { params: search ? { search } : {} });
    return response.data;
  },

  addLeagueMember: async (leagueId: number, request: AddLeagueMemberRequest): Promise<UserProfile> => {
    const response = await axiosInstance.post(`/api/admin/leagues/${leagueId}/members`, request);
    return response.data;
  },

  getMemberPredictions: async (leagueId: number, matchdayId: number, userId: number): Promise<Prediction[]> => {
    const response = await axiosInstance.get(`/api/admin/leagues/${leagueId}/matchdays/${matchdayId}/members/${userId}/predictions`);
    return response.data;
  },

  saveMemberPredictions: async (
    leagueId: number,
    matchdayId: number,
    userId: number,
    predictions: AdminPredictionInput[]
  ): Promise<Prediction[]> => {
    const response = await axiosInstance.post(
      `/api/admin/leagues/${leagueId}/matchdays/${matchdayId}/members/${userId}/predictions`,
      { predictions }
    );
    return response.data;
  },

  // Divisions
  getAllDivisions: async (): Promise<Division[]> => {
    const response = await axiosInstance.get('/api/divisions');
    return response.data;
  },

  createDivision: async (request: CreateDivisionRequest): Promise<Division> => {
    const response = await axiosInstance.post('/api/admin/divisions', request);
    return response.data;
  },

  updateDivision: async (divisionId: number, request: Partial<CreateDivisionRequest>): Promise<Division> => {
    const response = await axiosInstance.put(`/api/admin/divisions/${divisionId}`, request);
    return response.data;
  },

  deleteDivision: async (divisionId: number): Promise<void> => {
    await axiosInstance.delete(`/api/admin/divisions/${divisionId}`);
  },

  // Teams
  getTeamsByDivision: async (divisionId: number): Promise<Team[]> => {
    const response = await axiosInstance.get(`/api/divisions/${divisionId}/teams`);
    return response.data;
  },

  createTeam: async (request: CreateTeamRequest): Promise<Team> => {
    const response = await axiosInstance.post('/api/admin/teams', request);
    return response.data;
  },

  updateTeam: async (teamId: number, request: Partial<CreateTeamRequest>): Promise<Team> => {
    const response = await axiosInstance.put(`/api/admin/teams/${teamId}`, request);
    return response.data;
  },

  deleteTeam: async (teamId: number): Promise<void> => {
    await axiosInstance.delete(`/api/admin/teams/${teamId}`);
  },

  uploadAsset: async (
    file: File,
    assetType: 'division-logo' | 'team-badge' | 'login-hero' | 'app-logo' | 'theme-image',
    entityId?: number
  ): Promise<UploadAssetResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetType', assetType);
    if (entityId) {
      formData.append('entityId', String(entityId));
    }

    const response = await axiosInstance.post('/api/admin/assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Matchdays
  createMatchday: async (request: CreateMatchdayRequest): Promise<Matchday> => {
    const response = await axiosInstance.post('/api/admin/matchdays', request);
    return response.data;
  },

  updateMatchdayStatus: async (matchdayId: number, status: string): Promise<Matchday> => {
    const response = await axiosInstance.put(`/api/admin/matchdays/${matchdayId}/status?status=${status}`);
    return response.data;
  },

  // Fixtures
  createFixture: async (request: CreateFixtureRequest): Promise<Fixture> => {
    const response = await axiosInstance.post('/api/admin/fixtures', request);
    return response.data;
  },

  bulkCreateFixtures: async (matchdayId: number, fixtures: Array<Omit<CreateFixtureRequest, 'matchdayId'>>): Promise<Fixture[]> => {
    const response = await axiosInstance.post('/api/admin/fixtures/bulk', { matchdayId, fixtures });
    return response.data;
  },

  updateFixtureMetadata: async (fixtureId: number, request: { kickoffAt?: string | null; displayOrder?: number }): Promise<Fixture> => {
    const response = await axiosInstance.put(`/api/admin/fixtures/${fixtureId}/metadata`, request);
    return response.data;
  },

  reorderFixtures: async (orders: Array<{ fixtureId: number; displayOrder: number }>): Promise<{ message: string }> => {
    const response = await axiosInstance.put('/api/admin/fixtures/reorder', { orders });
    return response.data;
  },

  updateFixtureResult: async (fixtureId: number, request: UpdateResultRequest): Promise<Fixture> => {
    const response = await axiosInstance.put(`/api/admin/fixtures/${fixtureId}/result`, request);
    return response.data;
  },
};
