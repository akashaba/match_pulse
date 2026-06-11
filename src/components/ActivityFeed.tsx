import React from 'react';
import {
  FaBell,
  FaBolt,
  FaCalendarPlus,
  FaCheckCircle,
  FaCrown,
  FaFutbol,
  FaTrophy,
  FaUserPlus,
} from 'react-icons/fa';
import { LeagueInsights } from '../types/standings.types';
import { cn } from '@/lib/utils';

type ActivityItem = LeagueInsights['activity'][number];

interface ActivityFeedProps {
  activity?: ActivityItem[];
  compact?: boolean;
  className?: string;
  title?: string;
}

const iconByType: Record<string, React.ElementType> = {
  fixtures: FaCalendarPlus,
  league_created: FaTrophy,
  member_joined: FaUserPlus,
  prediction: FaFutbol,
  results: FaCheckCircle,
  weekly_winner: FaCrown,
};

const formatRelativeTime = (value?: string) => {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activity = [],
  compact = false,
  className,
  title = 'Activity Feed',
}) => {
  return (
    <article className={cn('dashboard-panel overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className={cn('font-semibold text-slate-900', compact ? 'text-base' : 'text-xl')}>{title}</h2>
          <p className="text-xs font-semibold text-teal-700">League pulse</p>
        </div>
        <FaBell className="text-teal-600" />
      </div>

      <div className={cn('space-y-3 px-4 pb-4', compact && 'max-h-[24rem] overflow-y-auto pr-3')}>
        {activity.length ? activity.map((item, index) => {
          const Icon = iconByType[item.type] || FaBolt;
          return (
            <div
              key={`${item.id || item.message}-${index}`}
              className="flex gap-3 rounded-[1.15rem] border border-white/55 bg-white/42 p-3 shadow-sm"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-600 text-white shadow-[0_10px_22px_rgb(13_148_157_/_0.22)]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-slate-900">{item.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{formatRelativeTime(item.at)}</span>
                  {item.user?.username && (
                    <span className="rounded-full bg-white/55 px-2 py-0.5 text-teal-700">{item.user.username}</span>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="designed-empty-state py-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-teal-600 text-white">
              <FaBolt />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No activity yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Predictions, new members, fixtures, and results will appear here.
            </p>
          </div>
        )}
      </div>
    </article>
  );
};

export default ActivityFeed;
