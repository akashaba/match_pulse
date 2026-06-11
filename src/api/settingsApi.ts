import axiosInstance from './axiosConfig';

export interface LoginSettings {
  loginHeroPath: string | null;
  loginHeroUrl: string;
  defaultLoginHeroUrl: string;
}

export interface ScoringRules {
  exactScore: number;
  correctOutcome: number;
  wrongPrediction: number;
  jokerMultiplier: number;
}

export interface AppSettings {
  appName: string;
  appLogoPath: string | null;
  appLogoUrl: string;
  themeImagePath: string | null;
  themeImageUrl: string;
  loginHeroPath: string | null;
  loginHeroUrl: string;
  defaultSportId: number | null;
  defaultDivisionId: number | null;
  scoringRules: ScoringRules;
}

export const settingsApi = {
  getLoginSettings: async (): Promise<LoginSettings> => {
    const response = await axiosInstance.get('/api/settings/login');
    return response.data;
  },

  getAppSettings: async (): Promise<AppSettings> => {
    const response = await axiosInstance.get('/api/settings/app');
    return response.data;
  },
};
