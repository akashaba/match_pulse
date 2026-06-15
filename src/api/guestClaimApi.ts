import axiosInstance from './axiosConfig';
import { UserProfile } from './superAdminApi';

export interface GuestClaim {
  token: string;
  claimUrl: string;
  expiresAt: string;
  guest: UserProfile;
}

export interface GuestClaimPreview {
  guest: UserProfile;
  expiresAt: string;
  claimedAt?: string;
  expired: boolean;
}

export const guestClaimApi = {
  createClaim: async (leagueId: number, guestUserId: number): Promise<GuestClaim> => {
    const response = await axiosInstance.post('/api/guest-claims', { leagueId, guestUserId });
    return response.data;
  },

  getClaim: async (token: string): Promise<GuestClaimPreview> => {
    const response = await axiosInstance.get(`/api/guest-claims/${token}`);
    return response.data;
  },

  claim: async (token: string): Promise<{ message: string; transferredLeagues: number }> => {
    const response = await axiosInstance.post(`/api/guest-claims/${token}/claim`);
    return response.data;
  },
};
