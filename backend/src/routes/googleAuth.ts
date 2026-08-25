import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { requireAdmin } from '../lib/adminSession.js';
import { oauth2Client, generateGoogleAuthUrl } from '../lib/googleAuth.js';

const router = Router();
const stateCookieName = 'caksa-google-oauth-state';
const stateCookieOptions = {
  httpOnly: true,
  path: '/api/auth/google',
  sameSite: 'lax' as const,
  secure: config.isProduction,
};

const readCookie = (cookie: string | undefined, name: string): string | null => {
  if (!cookie) return null;
  const prefix = `${name}=`;
  const value = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
};

const secureEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

router.get('/google', requireAdmin, (_req, res) => {
  const state = randomBytes(32).toString('base64url');
  res.cookie(stateCookieName, state, { ...stateCookieOptions, maxAge: 10 * 60 * 1000 });
  res.redirect(generateGoogleAuthUrl(state));
});

router.get('/google/callback', async (req, res) => {
  const expectedState = readCookie(req.headers.cookie, stateCookieName);
  const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
  res.clearCookie(stateCookieName, stateCookieOptions);

  if (!expectedState || !receivedState || !secureEquals(expectedState, receivedState)) {
    return res.status(400).send('Google OAuth state tidak valid');
  }

  try {
    const code = req.query.code;

    if (!code || typeof code !== 'string') {
      return res.status(400).send('Authorization code tidak ditemukan');
    }

    const { tokens } = await oauth2Client.getToken(code);

    console.log('TOKENS:', tokens);

    console.log('REFRESH TOKEN:', tokens.refresh_token);

    if (!tokens.refresh_token) {
      return res.status(400).send('Google OAuth tidak memberikan refresh token. Ulangi otorisasi dengan prompt consent.');
    }

    res.send(`
      <h1>Google Drive Authorization Berhasil</h1>
      <p>Simpan refresh token secara aman di variabel lingkungan server.</p>
    `);
  } catch (error) {
    console.error('Google OAuth error:', error);

    res.status(500).send(
      'Google OAuth authorization gagal',
    );
  }
});

export default router;
