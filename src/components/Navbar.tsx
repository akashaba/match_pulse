import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaBell,
  FaChartBar,
  FaCheck,
  FaClock,
  FaCrown,
  FaFutbol,
  FaSearch,
  FaShieldAlt,
  FaSignOutAlt,
  FaTable,
  FaThLarge,
  FaUserCircle,
  FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../api/notificationApi';
import { AppNotification } from '../types/notification.types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface NavbarProps {
  children?: React.ReactNode;
}

const Navbar: React.FC<NavbarProps> = ({ children }) => {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const getInitials = (username: string) => username.slice(0, 2).toUpperCase();
  const formatNotificationTime = (value: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(value).toLocaleDateString();
  };

  const { data: notificationData } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.getNotifications,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notificationIcon = (notification: AppNotification) => {
    if (notification.type === 'deadline') return <FaClock />;
    if (notification.type === 'weekly_winner') return <FaCrown />;
    if (notification.type === 'fixtures' || notification.type === 'results') return <FaFutbol />;
    return <FaBell />;
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: FaThLarge, show: true, active: (pathname: string) => pathname === '/' },
    { path: '/leagues', label: 'Leagues', icon: FaUsers, show: true, active: (pathname: string) => pathname === '/leagues' },
    { path: '/leagues', label: 'Standings', icon: FaTable, show: true, active: (pathname: string) => pathname.includes('/standings') },
    { path: '/leagues', label: 'Predictions', icon: FaChartBar, show: true, active: (pathname: string) => pathname.includes('/matchdays/') },
    { path: '/admin', label: 'Admin', icon: FaShieldAlt, show: isAdmin, active: (pathname: string) => pathname.startsWith('/admin') },
    { path: '/super-admin', label: 'Super Admin', icon: FaCrown, show: isSuperAdmin, active: (pathname: string) => pathname.startsWith('/super-admin') },
  ].filter((item) => item.show);

  return (
    <>
      <Link to="/" className="app-brand hidden lg:flex">
        <img src="/matchpulse-logo.png" alt="MatchPulse" className="brand-logo-image" />
        <span className="text-2xl font-bold tracking-normal text-slate-900">MatchPulse</span>
      </Link>

      <aside className="app-sidebar hidden lg:flex">
        <nav className="flex flex-1 flex-col gap-3">
          {navItems.map(({ path, label, icon: Icon, active: isItemActive }) => {
            const active = isItemActive(location.pathname);
            return (
              <Link
                key={`${label}-${path}`}
                to={path}
                className={cn('app-sidebar-link', active && 'app-sidebar-link-active')}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/50 pt-5">
          <Link to="/profile" className="mb-4 flex items-center gap-3 rounded-2xl bg-white/40 p-3 text-slate-800 transition hover:bg-white/60">
            <Avatar className="h-10 w-10 ring-2 ring-white/70">
              {user?.profilePhoto ? <AvatarImage src={user.profilePhoto} alt={user.username} /> : null}
              <AvatarFallback className="bg-teal-600 text-white text-xs font-semibold">
                {user ? getInitials(user.username) : <FaUserCircle />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.username}</p>
              <p className="text-xs text-teal-700">Profile</p>
            </div>
          </Link>

          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start gap-3 rounded-2xl text-slate-600 hover:bg-white/50 hover:text-rose-500"
          >
            <FaSignOutAlt />
            Logout
          </Button>
        </div>
      </aside>

      <header className="app-topbar">
        <Link to="/" className="flex items-center gap-2 text-slate-900 lg:hidden">
          <img src="/matchpulse-logo.png" alt="MatchPulse" className="brand-logo-image brand-logo-image-sm" />
          <span className="font-bold">MatchPulse</span>
        </Link>

        <div className="hidden items-center gap-3 text-sm font-semibold text-teal-700 lg:flex">
          <span>Welcome back, {user?.username}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {children}
          <button type="button" className="app-icon-button" aria-label="Search">
            <FaSearch />
          </button>
          <div className="relative">
            <button
              type="button"
              className="app-icon-button relative"
              aria-label="Notifications"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <FaBell />
              {!!notificationData?.unreadCount && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                  {notificationData.unreadCount > 9 ? '9+' : notificationData.unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-12 z-[90] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.35rem] border border-white/60 bg-[#e3f0ed]/92 shadow-[0_24px_60px_rgb(56_86_98_/_0.22)] backdrop-blur-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-white/50 px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-900">Notifications</p>
                    <p className="text-xs font-semibold text-teal-700">{notificationData?.unreadCount || 0} unread</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-white/55 px-3 py-1 text-xs font-bold text-teal-700 transition hover:bg-white/75"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-[26rem] overflow-y-auto p-3">
                  {notificationData?.notifications?.length ? notificationData.notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={cn(
                        'mb-2 flex w-full gap-3 rounded-2xl border p-3 text-left transition last:mb-0',
                        notification.readAt
                          ? 'border-white/45 bg-white/35 text-slate-600 hover:bg-white/50'
                          : 'border-teal-200/70 bg-white/65 text-slate-900 shadow-sm hover:bg-white/80'
                      )}
                      onClick={() => !notification.readAt && markReadMutation.mutate(notification.id)}
                    >
                      <span className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-full text-white',
                        notification.readAt ? 'bg-slate-400' : 'bg-teal-600'
                      )}>
                        {notification.readAt ? <FaCheck /> : notificationIcon(notification)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">{notification.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{notification.message}</span>
                        <span className="mt-2 block text-[11px] font-bold text-teal-700">{formatNotificationTime(notification.createdAt)}</span>
                      </span>
                    </button>
                  )) : (
                    <div className="px-4 py-8 text-center">
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/55 text-teal-700">
                        <FaBell />
                      </div>
                      <p className="font-bold text-slate-900">No notifications yet</p>
                      <p className="mt-1 text-sm text-slate-500">Deadlines, results, and league movement will land here.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {user && (
            <Link to="/profile" className="hidden items-center gap-3 rounded-full bg-white/55 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm sm:flex">
              <Avatar className="h-9 w-9">
                {user.profilePhoto ? <AvatarImage src={user.profilePhoto} alt={user.username} /> : null}
                <AvatarFallback className="bg-teal-600 text-xs text-white">{getInitials(user.username)}</AvatarFallback>
              </Avatar>
              <span>{user.username}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="app-icon-button text-slate-600 hover:text-rose-500 lg:hidden"
            aria-label="Log out"
            title="Log out"
          >
            <FaSignOutAlt />
          </button>
        </div>
      </header>

      <nav className="app-mobile-nav lg:hidden">
        {navItems.slice(0, 5).map(({ path, label, icon: Icon, active: isItemActive }) => {
          const active = isItemActive(location.pathname);
          return (
            <Link key={`${label}-mobile`} to={path} className={cn('app-mobile-link', active && 'text-teal-700')}>
              <Icon />
              <span>{label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Navbar;
