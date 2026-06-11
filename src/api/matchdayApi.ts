import axiosInstance from './axiosConfig';
import { Matchday } from '../types/matchday.types';

export const matchdayApi = {
  getMatchdaysByDivision: async (divisionId: number): Promise<Matchday[]> => {
    const response = await axiosInstance.get(`/api/divisions/${divisionId}/matchdays`);
    return response.data;
  },

  getMatchdayById: async (matchdayId: number): Promise<Matchday> => {
    const response = await axiosInstance.get(`/api/matchdays/${matchdayId}`);
    return response.data;
  },
};
