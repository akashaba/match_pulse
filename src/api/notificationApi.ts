import axiosInstance from './axiosConfig';
import { AppNotification, NotificationsResponse } from '../types/notification.types';

export const notificationApi = {
  getNotifications: async (): Promise<NotificationsResponse> => {
    const response = await axiosInstance.get('/api/notifications');
    return response.data;
  },

  markAsRead: async (notificationId: number): Promise<AppNotification> => {
    const response = await axiosInstance.put(`/api/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<{ message: string }> => {
    const response = await axiosInstance.put('/api/notifications/read-all');
    return response.data;
  },
};
