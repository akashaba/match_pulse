import axiosInstance from './axiosConfig';
import { Prediction } from '../types/prediction.types';

export interface PredictionInput {
  fixtureId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  isJoker?: boolean;
}

export interface MatchdayPredictionsResponse {
  revealed: boolean;
  revealedFixtureIds?: number[];
  predictions: Prediction[];
}

const unwrapPredictions = (data: Prediction[] | MatchdayPredictionsResponse): Prediction[] =>
  Array.isArray(data) ? data : data.predictions;

export const predictionApi = {
  submitPrediction: async (leagueId: number, input: PredictionInput): Promise<Prediction> => {
    const response = await axiosInstance.post('/api/predictions', {
      fixtureId: input.fixtureId,
      leagueId: leagueId,
      predictedHomeScore: input.predictedHomeScore,
      predictedAwayScore: input.predictedAwayScore,
      isJoker: input.isJoker ?? false,
    });
    return response.data;
  },

  getPredictionsByMatchday: async (leagueId: number, matchdayId: number): Promise<Prediction[]> => {
    const response = await axiosInstance.get(
      `/api/predictions/matchday/${matchdayId}/league/${leagueId}`
    );
    return unwrapPredictions(response.data);
  },

  getUserPredictionsForMatchday: async (
    matchdayId: number,
    leagueId: number
  ): Promise<Prediction[]> => {
    const response = await axiosInstance.get(
      `/api/predictions/matchday/${matchdayId}/league/${leagueId}`
    );
    return unwrapPredictions(response.data);
  },

  getAllPredictionsForMatchday: async (
    matchdayId: number,
    leagueId: number
  ): Promise<MatchdayPredictionsResponse> => {
    const response = await axiosInstance.get(
      `/api/predictions/matchday/${matchdayId}/league/${leagueId}/all`
    );
    return Array.isArray(response.data) ? { revealed: true, predictions: response.data } : response.data;
  },

  getPredictionStatusForMatchdays: async (
    leagueId: number,
    matchdayIds: number[]
  ): Promise<Record<number, boolean>> => {
    const response = await axiosInstance.get(
      `/api/predictions/league/${leagueId}/status`,
      { params: { matchdayIds: matchdayIds.join(',') } }
    );
    return response.data;
  },
};
