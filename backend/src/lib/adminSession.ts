import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'strict' as const,
  secure: config.isProduction,
};

const sign = (value: string): string =>
  createHmac('sha256', config.adminSessionSecret).update(value).digest('base64url');

const readCookie = (request: Request, name: string): string | null => {
  const cookie = request.headers.cookie;
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

const createSessionValue = (): string => {
  const payload = Buffer.from(`${Date.now() + sessionLifetimeMs}.${randomBytes(32).toString('base64url')}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const hasValidAdminToken = (token: string): boolean => secureEquals(token, config.adminApiToken);

export const hasAdminSession = (request: Request): boolean => {
  const session = readCookie(request, config.adminSessionCookieName);
  if (!session) return false;

  const [payload, signature, extra] = session.split('.');
  if (!payload || !signature || extra || !secureEquals(signature, sign(payload))) return false;

  try {
    const [expiresAt, nonce, extraPayload] = Buffer.from(payload, 'base64url').toString('utf8').split('.');
    return !extraPayload && Boolean(nonce) && Number.isSafeInteger(Number(expiresAt)) && Number(expiresAt) > Date.now();
  } catch {
    return false;
  }
};

export const startAdminSession = (response: Response): void => {
  response.cookie(config.adminSessionCookieName, createSessionValue(), {
    ...cookieOptions,
    maxAge: sessionLifetimeMs,
  });
};

export const endAdminSession = (response: Response): void => {
  response.clearCookie(config.adminSessionCookieName, cookieOptions);
};

export const requireAdmin = (request: Request, response: Response, next: NextFunction): void => {
  if (!hasAdminSession(request)) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};
