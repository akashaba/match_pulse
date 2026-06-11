import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';
import Navbar from '../components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Shield, Camera, Trash2, ArrowLeft, Upload, KeyRound } from 'lucide-react';

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateProfileMutation = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (data) => {
      updateUser({ profilePhoto: data.profilePhoto });
      setSuccess('Profile photo updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setError(null), 5000);
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: userApi.removeProfilePhoto,
    onSuccess: () => {
      updateUser({ profilePhoto: undefined });
      setSuccess('Profile photo removed!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to remove photo');
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      updateProfileMutation.mutate({ profilePhoto: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    if (window.confirm('Are you sure you want to remove your profile photo?')) {
      removePhotoMutation.mutate();
    }
  };

  const changePasswordMutation = useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to change password');
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }
    
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stadium flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stadium">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <User className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/20 border border-destructive rounded-lg text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-primary/20 border border-primary rounded-lg text-primary">
            {success}
          </div>
        )}

        {/* Profile Photo Card */}
        <Card className="bg-card border-t-4 border-t-primary mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Profile Photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <Avatar className="w-32 h-32 border-4 border-primary">
                  {user.profilePhoto ? (
                    <AvatarImage src={user.profilePhoto} alt={user.username} />
                  ) : null}
                  <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="text-center">
                <p className="text-xl font-bold text-white">{user.username}</p>
                <p className="text-muted-foreground">{user.email}</p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />

              <div className="flex gap-3">
                <Button
                  onClick={handleUploadClick}
                  disabled={updateProfileMutation.isPending}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {updateProfileMutation.isPending ? 'Uploading...' : 'Upload Photo'}
                </Button>

                {user.profilePhoto && (
                  <Button
                    variant="outline"
                    onClick={handleRemovePhoto}
                    disabled={removePhotoMutation.isPending}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {removePhotoMutation.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Accepted formats: JPG, PNG, GIF (max 2MB)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Information Card */}
        <Card className="bg-card border-t-4 border-t-primary mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Username
              </Label>
              <div className="p-3 bg-muted rounded-lg text-foreground">
                {user.username}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email
              </Label>
              <div className="p-3 bg-muted rounded-lg text-foreground">
                {user.email}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                Role
              </Label>
              <div className="p-3 bg-muted rounded-lg">
                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="bg-card border-t-4 border-t-primary mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  type="password"
                  id="currentPassword"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  type="password"
                  id="newPassword"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  type="password"
                  id="confirmPassword"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back Button */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <Link to="/leagues">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Leagues
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
