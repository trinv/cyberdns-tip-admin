import { Request, Response, NextFunction } from 'express';
import { getSessionUser } from '../db/queries.ts';

export interface SessionUser {
  id: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  user?: SessionUser;
}

async function resolveSessionUser(req: AuthRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;
  const token = authHeader.slice('Bearer '.length);
  const user = await getSessionUser(token);
  if (user) req.user = user;
}

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await resolveSessionUser(req);
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await resolveSessionUser(req);
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: sign-in required' });
  }
  next();
};

// Gate a route to a specific set of roles. Must run AFTER requireAuth (it
// relies on req.user already being populated) — 401 if there's no verified
// user at all, 403 if they're verified but under-privileged.
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: sign-in required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: requires role ${roles.join(' or ')} (current: ${req.user.role})` });
    }
    next();
  };
};
