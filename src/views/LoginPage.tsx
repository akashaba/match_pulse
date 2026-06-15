import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { authApi } from '../api/authApi';
import { settingsApi } from '../api/settingsApi';
import { useAuth } from '../context/AuthContext';
import { LoginRequest, RegisterRequest } from '../types/auth.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AuthMode = 'login' | 'register';

interface LoginPageProps {
  initialMode?: AuthMode;
}

const LoginPage: React.FC<LoginPageProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [formData, setFormData] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<string | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/';

  const { data: loginSettings } = useQuery({
    queryKey: ['login-settings'],
    queryFn: settingsApi.getLoginSettings,
    staleTime: 5 * 60 * 1000,
  });

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutEndTime) {
      setLockoutCountdown('');
      return;
    }

    const updateCountdown = () => {
      const end = new Date(lockoutEndTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setLockoutEndTime(null);
        setLockoutCountdown('');
        setError('');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setLockoutCountdown(`${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockoutEndTime]);

  const loginMutation = useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: (data) => {
      setLockoutEndTime(null);
      login(data);
      navigate(returnTo, { replace: true });
    },
    onError: (error: any) => {
      const status = error.response?.status;
      if (status === 423) {
        // Account locked
        const endTime = error.response?.data?.lockoutEndTime;
        setLockoutEndTime(endTime || null);
        setError(error.response?.data?.message || 'Account is locked');
      } else {
        setError(error.response?.data?.message || 'Invalid username or password');
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: (request: RegisterRequest) => authApi.register(request),
    onSuccess: (data) => {
      login(data);
      navigate(returnTo === '/' ? '/?welcome=1' : returnTo, { replace: true });
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Registration failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      loginMutation.mutate({
        username: formData.username,
        password: formData.password,
      });
      return;
    }

    registerMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const isLockedOut = !!lockoutEndTime;
  const heroImage = loginSettings?.loginHeroUrl || '/login-hero-vr-sports.png';
  const isLogin = mode === 'login';
  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setLockoutEndTime(null);
    setLockoutCountdown('');
  };

  return (
    <div className="login-page-bg flex min-h-screen items-center justify-center p-3 pt-24 text-slate-900 sm:p-5 sm:pt-28 lg:p-8 lg:pt-28">
      <div className="login-brand">
        <img src="/matchpulse-logo.png" alt="MatchPulse" className="brand-logo-image" />
        <span className="text-2xl font-bold tracking-normal text-slate-900">MatchPulse</span>
      </div>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.9rem] border border-white/55 bg-white/34 p-3 shadow-[0_28px_78px_rgb(56_86_98_/_0.22)] backdrop-blur-2xl sm:rounded-[2.35rem] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative min-h-[15rem] overflow-hidden rounded-[1.45rem] border border-white/45 bg-teal-100/45 sm:min-h-[22rem] lg:min-h-[35rem]">
          <img
            src={heroImage}
            alt="Sports prediction login"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-teal-950/10 via-teal-900/5 to-teal-950/45" />
          <div className="absolute bottom-5 left-5 right-5 text-white sm:bottom-8 sm:left-8 sm:right-8">
            <p className="max-w-md text-2xl font-semibold leading-tight sm:text-3xl">
              {isLogin ? 'Make every matchday count.' : 'Join the pulse before kickoff.'}
            </p>
            <p className="mt-3 max-w-sm text-sm text-white/75">
              {isLogin
                ? 'Sign in to manage leagues, fixtures, standings, and predictions.'
                : 'Create your account and start competing in private prediction leagues.'}
            </p>
          </div>
        </section>

        <section className="flex min-h-[29rem] items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <h1 className="text-4xl font-bold leading-none text-slate-900 sm:text-5xl">
                {isLogin ? 'Log in' : 'Create account'}
              </h1>
              <p className="mt-4 text-sm text-slate-500">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  className="font-semibold text-teal-700 underline underline-offset-4"
                  onClick={() => switchMode(isLogin ? 'register' : 'login')}
                >
                  {isLogin ? 'Create an Account' : 'Log in'}
                </button>
              </p>
            </div>

            {isLogin && isLockedOut && (
              <div className="mb-7 rounded-2xl border border-orange-200 bg-orange-50/75 p-4">
                <div className="mb-1 flex items-center gap-2 font-medium text-orange-700">
                  <Lock className="h-4 w-4" />
                  Account Locked
                </div>
                <p className="text-sm text-orange-700/80">
                  Too many failed login attempts. Try again in{' '}
                  <span className="font-bold">{lockoutCountdown}</span>
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="username" className="text-base font-semibold text-slate-900">Username</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    type="text"
                    id="username"
                    name="username"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    disabled={isLogin && isLockedOut}
                    className="h-14 rounded-full pl-14 pr-5 text-base"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-base font-semibold text-slate-900">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="h-14 rounded-full px-6 text-base"
                  />
                </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="password" className="text-base font-semibold text-slate-900">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={isLogin ? undefined : 6}
                    disabled={isLogin && isLockedOut}
                    className="h-14 rounded-full pl-6 pr-16 text-base"
                  />
                  <button
                    type="button"
                    className="absolute right-5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-white/60 hover:text-teal-700"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && !(isLogin && isLockedOut) && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-14 w-full rounded-full text-base"
                disabled={isSubmitting || (isLogin && isLockedOut)}
              >
                {isSubmitting
                  ? (isLogin ? 'Logging in...' : 'Creating account...')
                  : isLogin && isLockedOut
                    ? 'Account Locked'
                    : isLogin
                      ? 'Log in'
                      : 'Create account'}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
