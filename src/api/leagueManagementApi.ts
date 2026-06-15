import axiosInstance from './axiosConfig';
import { UserProfile } from './superAdminApi';
import { Prediction } from '../types/prediction.types';
import { AdminPredictionInput, AddLeagueMemberRequest } from './adminApi';

export const leagueManagementApi = {
  searchUsers: async (leagueId: number, search?: string): Promise<UserProfile[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/manage/users`, {
      params: search ? { search } : {},
    });
    return response.data;
  },

  addMember: async (leagueId: number, request: AddLeagueMemberRequest): Promise<UserProfile> => {
    const response = await axiosInstance.post(`/api/leagues/${leagueId}/members`, request);
    return response.data;
  },

  getMemberPredictions: async (leagueId: number, matchdayId: number, userId: number): Promise<Prediction[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/matchdays/${matchdayId}/members/${userId}/predictions`);
    return response.data;
  },

  saveMemberPredictions: async (
    leagueId: number,
    matchdayId: number,
    userId: number,
    predictions: AdminPredictionInput[],
  ): Promise<Prediction[]> => {
    const response = await axiosInstance.post(
      `/api/leagues/${leagueId}/matchdays/${matchdayId}/members/${userId}/predictions`,
      { predictions },
    );
    return response.data;
  },
};
