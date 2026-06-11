import axiosInstance from './axiosConfig';
import { LeagueInsights, LeagueStanding } from '../types/standings.types';

export const standingsApi = {
  getLeagueStandings: async (leagueId: number, filter = 'overall'): Promise<LeagueStanding[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/standings`, { params: { filter } });
    return response.data;
  },

  getLeagueInsights: async (leagueId: number): Promise<LeagueInsights> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/insights`);
    return response.data;
  },

  getMatchdaySummary: async (leagueId: number, matchdayId: number) => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/matchdays/${matchdayId}/summary`);
    return response.data;
  },
};
