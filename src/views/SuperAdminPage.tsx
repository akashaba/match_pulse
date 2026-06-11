import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Crown, ImageIcon, KeyRound, Lock, RotateCcw, Save, Search, Shield, Unlock, Upload, Users, X } from 'lucide-react';
import { superAdminApi, UserProfile } from '../api/superAdminApi';
import { adminApi } from '../api/adminApi';
import { settingsApi } from '../api/settingsApi';
import Navbar from '../components/Navbar';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const SuperAdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [loginHeroFile, setLoginHeroFile] = useState<File | null>(null);
  const [loginHeroPreview, setLoginHeroPreview] = useState<string | null>(null);
  const [appLogoFile, setAppLogoFile] = useState<File | null>(null);
  const [themeImageFile, setThemeImageFile] = useState<File | null>(null);
  const [appForm, setAppForm] = useState({
    appName: 'MatchPulse',
    appLogoPath: '',
    themeImagePath: '',
    defaultSportId: 0,
    defaultDivisionId: 0,
    scoringRules: {
      exactScore: 5,
      correctOutcome: 3,
      wrongPrediction: 0,
      jokerMultiplier: 2,
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: superAdminApi.getAllUsers,
  });

  const { data: loginSettings } = useQuery({
    queryKey: ['login-settings'],
    queryFn: settingsApi.getLoginSettings,
  });

  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: settingsApi.getAppSettings,
  });

  const { data: sports } = useQuery({
    queryKey: ['sports'],
    queryFn: adminApi.getAllSports,
  });

  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: adminApi.getAllDivisions,
  });

  useEffect(() => {
    if (!appSettings) return;
    setAppForm({
      appName: appSettings.appName,
      appLogoPath: appSettings.appLogoPath || '',
      themeImagePath: appSettings.themeImagePath || '',
      defaultSportId: appSettings.defaultSportId || 0,
      defaultDivisionId: appSettings.defaultDivisionId || 0,
      scoringRules: appSettings.scoringRules,
    });
  }, [appSettings]);

  useEffect(() => {
    if (!loginHeroFile) {
      setLoginHeroPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(loginHeroFile);
    setLoginHeroPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [loginHeroFile]);

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      superAdminApi.updateUserRole(userId, role),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setSuccess(`Successfully updated ${updatedUser.username}'s role to ${updatedUser.role}`);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update user role');
      setTimeout(() => setError(null), 5000);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      superAdminApi.resetUserPassword(userId, newPassword),
    onSuccess: () => {
      setSuccess(`Password reset successfully for ${resetPasswordModal?.username}`);
      setResetPasswordModal(null);
      setNewPassword('');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to reset password');
      setTimeout(() => setError(null), 5000);
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (userId: number) => superAdminApi.unlockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setSuccess('Account unlocked successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to unlock account');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateLoginHeroMutation = useMutation({
    mutationFn: async (file: File | null) => {
      const asset = file ? await adminApi.uploadAsset(file, 'login-hero') : null;
      return superAdminApi.updateLoginHero(asset?.path ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['login-settings'] });
      setLoginHeroFile(null);
      setSuccess('Login image updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update login image');
      setTimeout(() => setError(null), 5000);
    },
  });

  const updateAppSettingsMutation = useMutation({
    mutationFn: async () => {
      const [logoAsset, themeAsset] = await Promise.all([
        appLogoFile ? adminApi.uploadAsset(appLogoFile, 'app-logo') : Promise.resolve(null),
        themeImageFile ? adminApi.uploadAsset(themeImageFile, 'theme-image') : Promise.resolve(null),
      ]);

      return superAdminApi.updateAppSettings({
        appName: appForm.appName,
        appLogoPath: logoAsset?.path ?? (appForm.appLogoPath || null),
        themeImagePath: themeAsset?.path ?? (appForm.themeImagePath || null),
        defaultSportId: appForm.defaultSportId || null,
        defaultDivisionId: appForm.defaultDivisionId || null,
        scoringRules: appForm.scoringRules,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      setAppLogoFile(null);
      setThemeImageFile(null);
      setSuccess('App setup updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update app setup');
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleRoleChange = (userId: number, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleResetPassword = () => {
    if (!resetPasswordModal || !newPassword.trim()) return;
    resetPasswordMutation.mutate({ userId: resetPasswordModal.id, newPassword });
  };

  const filteredUsers = users?.filter((user: UserProfile) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 gap-1">
            <Crown className="h-3 w-3" />
            Super Admin
          </Badge>
        );
      case 'ADMIN':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            User
          </Badge>
        );
    }
  };

  const getUserStats = () => {
    if (!users) return { total: 0, admins: 0, superAdmins: 0, regular: 0, locked: 0 };
    return {
      total: users.length,
      superAdmins: users.filter((u: UserProfile) => u.role === 'SUPER_ADMIN').length,
      admins: users.filter((u: UserProfile) => u.role === 'ADMIN').length,
      regular: users.filter((u: UserProfile) => u.role === 'USER').length,
      locked: users.filter((u: UserProfile) => u.accountLocked).length,
    };
  };

  const stats = getUserStats();
  const activeLoginHero = loginHeroPreview || loginSettings?.loginHeroUrl || '/login-hero-vr-sports.png';

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Crown className="h-8 w-8 text-purple-500" />
            Super Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage user roles, passwords, and account access</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Super Admins</p>
                  <p className="text-2xl font-bold text-purple-500">{stats.superAdmins}</p>
                </div>
                <Crown className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Admins</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.admins}</p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Regular Users</p>
                  <p className="text-2xl font-bold">{stats.regular}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Locked</p>
                  <p className="text-2xl font-bold text-red-500">{stats.locked}</p>
                </div>
                <Lock className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/85 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              App Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="appName">App Name</Label>
                <Input
                  id="appName"
                  value={appForm.appName}
                  onChange={(event) => setAppForm({ ...appForm, appName: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Sport</Label>
                <Select
                  value={appForm.defaultSportId ? String(appForm.defaultSportId) : ''}
                  onValueChange={(value) => setAppForm({ ...appForm, defaultSportId: Number(value) || 0 })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sports?.map((sport) => (
                      <SelectItem key={sport.id} value={String(sport.id)}>{sport.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Division</Label>
                <Select
                  value={appForm.defaultDivisionId ? String(appForm.defaultDivisionId) : ''}
                  onValueChange={(value) => setAppForm({ ...appForm, defaultDivisionId: Number(value) || 0 })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions?.map((division) => (
                      <SelectItem key={division.id} value={String(division.id)}>{division.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="appLogo">Logo</Label>
                <Input id="appLogo" type="file" accept="image/*" onChange={(event) => setAppLogoFile(event.target.files?.[0] ?? null)} />
                {appSettings?.appLogoUrl && <p className="text-xs text-muted-foreground">Current logo is configured.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="themeImage">Theme Image</Label>
                <Input id="themeImage" type="file" accept="image/*" onChange={(event) => setThemeImageFile(event.target.files?.[0] ?? null)} />
                {appSettings?.themeImageUrl && <p className="text-xs text-muted-foreground">Current theme image is configured.</p>}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/60 bg-white/35 p-4">
              <h3 className="mb-3 font-black text-foreground">Scoring Rules</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['exactScore', 'Exact Score'],
                  ['correctOutcome', 'Correct Outcome'],
                  ['wrongPrediction', 'Wrong Prediction'],
                  ['jokerMultiplier', 'Joker Multiplier'],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      min={key === 'jokerMultiplier' ? 1 : 0}
                      value={appForm.scoringRules[key as keyof typeof appForm.scoringRules]}
                      onChange={(event) => setAppForm({
                        ...appForm,
                        scoringRules: {
                          ...appForm.scoringRules,
                          [key]: Number(event.target.value) || 0,
                        },
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="gap-2"
              onClick={() => updateAppSettingsMutation.mutate()}
              disabled={updateAppSettingsMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {updateAppSettingsMutation.isPending ? 'Saving...' : 'Save App Setup'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/85 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Login Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg border bg-muted">
                <img
                  src={activeLoginHero}
                  alt="Current login hero"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    This image appears on the login page. Upload a portrait image for the best crop.
                  </p>
                  {loginSettings?.loginHeroPath && (
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      Storage path: {loginSettings.loginHeroPath}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loginHeroUpload">Upload image</Label>
                  <Input
                    id="loginHeroUpload"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setLoginHeroFile(event.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="gap-2"
                    onClick={() => updateLoginHeroMutation.mutate(loginHeroFile)}
                    disabled={!loginHeroFile || updateLoginHeroMutation.isPending}
                  >
                    <Upload className="h-4 w-4" />
                    {updateLoginHeroMutation.isPending ? 'Saving...' : 'Save Login Image'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => updateLoginHeroMutation.mutate(null)}
                    disabled={updateLoginHeroMutation.isPending || !loginSettings?.loginHeroPath}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Use Default
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>User Management</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : filteredUsers && filteredUsers.length === 0 ? (
              <div className="designed-empty-state">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="designed-empty-icon">
                    <Users className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">No users found</h3>
                    <p className="text-sm text-muted-foreground">Try a different search term or invite users to create accounts.</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user: UserProfile) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {user.profilePhoto ? (
                              <img
                                src={user.profilePhoto}
                                alt={user.username}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-xs font-medium">
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="font-medium">{user.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {user.accountLocked ? (
                            <Badge variant="destructive" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Locked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  User
                                </div>
                              </SelectItem>
                              <SelectItem value="ADMIN">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Admin
                                </div>
                              </SelectItem>
                              <SelectItem value="SUPER_ADMIN">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4" />
                                  Super Admin
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                setResetPasswordModal(user);
                                setNewPassword('');
                              }}
                            >
                              <KeyRound className="h-3 w-3" />
                              Reset PW
                            </Button>
                            {user.accountLocked && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-green-500 border-green-500/30 hover:bg-green-500/10"
                                onClick={() => unlockMutation.mutate(user.id)}
                                disabled={unlockMutation.isPending}
                              >
                                <Unlock className="h-3 w-3" />
                                Unlock
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {filteredUsers?.map((user: UserProfile) => (
                  <div key={user.id} className="rounded-[1.25rem] border border-white/60 bg-white/45 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {user.profilePhoto ? (
                          <img
                            src={user.profilePhoto}
                            alt={user.username}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/20">
                            <span className="text-sm font-black">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-black text-foreground">{user.username}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      {user.accountLocked ? (
                        <Badge variant="destructive" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/45 px-3 py-2">
                        <span className="text-xs font-bold uppercase text-muted-foreground">Current Role</span>
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="space-y-2">
                        <Label>Change Role</Label>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setResetPasswordModal(user);
                            setNewPassword('');
                          }}
                        >
                          <KeyRound className="h-3 w-3" />
                          Reset Password
                        </Button>
                        {user.accountLocked && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => unlockMutation.mutate(user.id)}
                            disabled={unlockMutation.isPending}
                          >
                            <Unlock className="h-3 w-3" />
                            Unlock
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Reset Password
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResetPasswordModal(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reset password for <span className="font-medium text-foreground">{resetPasswordModal.username}</span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setResetPasswordModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={!newPassword.trim() || newPassword.length < 4 || resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPage;
