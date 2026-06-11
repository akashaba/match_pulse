import api from './axiosConfig';
import { UpdateProfileRequest, UserProfileResponse, ChangePasswordRequest } from '../types/auth.types';

export const userApi = {
  getCurrentUser: async (): Promise<UserProfileResponse> => {
    const response = await api.get('/api/users/me');
    return response.data;
  },

  updateProfile: async (request: UpdateProfileRequest): Promise<UserProfileResponse> => {
    const response = await api.put('/api/users/me/profile', request);
    return response.data;
  },

  removeProfilePhoto: async (): Promise<UserProfileResponse> => {
    const response = await api.delete('/api/users/me/profile-photo');
    return response.data;
  },

  changePassword: async (request: ChangePasswordRequest): Promise<{ message: string }> => {
    const response = await api.put('/api/auth/change-password', request);
    return response.data;
  },
};
