import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { endAdminSession, hasAdminSession, hasValidAdminToken, startAdminSession } from '../lib/adminSession.js';

const router = Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const readBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
};

router.post('/', loginRateLimit, (request, response) => {
  const token = readBearerToken(request.headers.authorization);
  if (!token || !hasValidAdminToken(token)) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  startAdminSession(response);
  response.status(204).end();
});

router.get('/', (request, response) => {
  if (!hasAdminSession(request)) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  response.status(204).end();
});

router.delete('/', (_request, response) => {
  endAdminSession(response);
  response.status(204).end();
});

export default router;
