export interface AppNotification {
  id: number;
  type: 'deadline' | 'fixtures' | 'results' | 'rank_passed' | 'invite_accepted' | 'member_joined' | 'weekly_winner' | string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  leagueId?: number;
  matchdayId?: number;
  fixtureId?: number;
  actor?: {
    id: number;
    username: string;
    profilePhoto?: string;
  };
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: AppNotification[];
}
