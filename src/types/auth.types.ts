export interface User {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  profilePhoto?: string;
}

export interface AuthResponse {
  id?: number;
  token: string;
  username: string;
  email: string;
  role: string;
  profilePhoto?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  profilePhoto?: string;
}

export interface UserProfileResponse {
  id: number;
  username: string;
  email: string;
  profilePhoto?: string;
  role: string;
  isGuest?: boolean;
  accountLocked?: boolean;
  failedLoginAttempts?: number;
  lockoutEndTime?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}
