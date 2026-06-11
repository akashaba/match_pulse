import axiosInstance from './axiosConfig';
import { League, CreateLeagueRequest, JoinLeagueRequest } from '../types/league.types';

export const leagueApi = {
  getUserLeagues: async (): Promise<League[]> => {
    const response = await axiosInstance.get('/api/leagues');
    return response.data;
  },

  getLeagueById: async (leagueId: number): Promise<League> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}`);
    return response.data;
  },

  createLeague: async (leagueData: CreateLeagueRequest): Promise<League> => {
    const response = await axiosInstance.post('/api/leagues', leagueData);
    return response.data;
  },

  joinLeague: async (joinData: JoinLeagueRequest): Promise<League> => {
    const response = await axiosInstance.post('/api/leagues/join', joinData);
    return response.data;
  },
};
