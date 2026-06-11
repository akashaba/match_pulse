import jwt from 'jsonwebtoken';

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

const jwtSecret = () => process.env.JWT_SECRET || 'sports-pred-local-dev-secret';

export function signSession(user: SessionUser) {
  return jwt.sign(user, jwtSecret(), { expiresIn: '24h' });
}

export function readBearerUser(request: Request): SessionUser | null {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return null;

  try {
    return jwt.verify(token, jwtSecret()) as SessionUser;
  } catch {
    return null;
  }
}

export function requireRole(user: SessionUser | null, roles: SessionUser['role'][]) {
  return !!user && roles.includes(user.role);
}
