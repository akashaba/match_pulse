import axiosInstance from './axiosConfig';
import { H2hMatchup, H2hStanding } from '../types/h2h.types';

export const h2hApi = {
  // Leaderboard
  getLeaderboardStandings: async (leagueId: number): Promise<H2hStanding[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/h2h/leaderboard/standings`);
    return response.data;
  },

  getLeaderboardMatchups: async (leagueId: number, matchdayId?: number): Promise<H2hMatchup[]> => {
    const params = matchdayId ? { matchdayId } : {};
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/h2h/leaderboard/matchups`, { params });
    return response.data;
  },

  generateLeaderboardMatchups: async (leagueId: number, matchdayId: number): Promise<H2hMatchup[]> => {
    const response = await axiosInstance.post(
      `/api/leagues/${leagueId}/h2h/leaderboard/generate`,
      null,
      { params: { matchdayId } }
    );
    return response.data;
  },

  // Knockout
  getKnockoutBracket: async (leagueId: number): Promise<H2hMatchup[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/h2h/knockout/bracket`);
    return response.data;
  },

  generateKnockoutBracket: async (leagueId: number): Promise<H2hMatchup[]> => {
    const response = await axiosInstance.post(`/api/leagues/${leagueId}/h2h/knockout/generate`);
    return response.data;
  },

  // Matchday-specific matchups
  getMyMatchupsForMatchday: async (leagueId: number, matchdayId: number): Promise<H2hMatchup[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/h2h/matchday/${matchdayId}/my-matchups`);
    return response.data;
  },

  getAllMatchupsForMatchday: async (leagueId: number, matchdayId: number): Promise<H2hMatchup[]> => {
    const response = await axiosInstance.get(`/api/leagues/${leagueId}/h2h/matchday/${matchdayId}/matchups`);
    return response.data;
  },
};
