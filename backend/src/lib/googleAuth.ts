import { google } from 'googleapis';
import { config } from '../config.js';

export const oauth2Client = new google.auth.OAuth2(
  config.googleOAuthClientId,
  config.googleOAuthClientSecret,
  config.googleOAuthRedirectUri,
);

export const generateGoogleAuthUrl = (state: string) => {
  return oauth2Client.generateAuthUrl({
    state,
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
};
