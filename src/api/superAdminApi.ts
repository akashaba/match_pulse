import axiosInstance from './axiosConfig';
import { AppSettings, LoginSettings, ScoringRules } from './settingsApi';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  profilePhoto?: string;
  role: string;
  accountLocked?: boolean;
  failedLoginAttempts?: number;
  lockoutEndTime?: string;
}

export interface UpdateUserRoleRequest {
  role: string;
}

export const superAdminApi = {
  getAllUsers: async (): Promise<UserProfile[]> => {
    const response = await axiosInstance.get('/api/super-admin/users');
    return response.data;
  },

  getUserById: async (userId: number): Promise<UserProfile> => {
    const response = await axiosInstance.get(`/api/super-admin/users/${userId}`);
    return response.data;
  },

  updateUserRole: async (userId: number, role: string): Promise<UserProfile> => {
    const response = await axiosInstance.put(`/api/super-admin/users/${userId}/role`, { role });
    return response.data;
  },

  resetUserPassword: async (userId: number, newPassword: string): Promise<{ message: string }> => {
    const response = await axiosInstance.put(`/api/super-admin/users/${userId}/reset-password`, { newPassword });
    return response.data;
  },

  unlockUser: async (userId: number): Promise<{ message: string }> => {
    const response = await axiosInstance.put(`/api/super-admin/users/${userId}/unlock`);
    return response.data;
  },

  updateLoginHero: async (loginHeroPath: string | null): Promise<LoginSettings> => {
    const response = await axiosInstance.put('/api/super-admin/settings/login-hero', { loginHeroPath });
    return response.data;
  },

  updateAppSettings: async (settings: {
    appName: string;
    appLogoPath?: string | null;
    themeImagePath?: string | null;
    defaultSportId?: number | null;
    defaultDivisionId?: number | null;
    scoringRules: ScoringRules;
  }): Promise<AppSettings> => {
    const response = await axiosInstance.put('/api/super-admin/settings/app', settings);
    return response.data;
  },
};
