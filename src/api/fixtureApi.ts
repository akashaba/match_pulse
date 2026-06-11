import axiosInstance from './axiosConfig';
import { Fixture } from '../types/fixture.types';

export const fixtureApi = {
  getFixturesByMatchday: async (matchdayId: number): Promise<Fixture[]> => {
    const response = await axiosInstance.get(`/api/matchdays/${matchdayId}/fixtures`);
    return response.data;
  },

  getFixtureById: async (fixtureId: number): Promise<Fixture> => {
    const response = await axiosInstance.get(`/api/fixtures/${fixtureId}`);
    return response.data;
  },
};
