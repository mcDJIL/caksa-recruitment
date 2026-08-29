const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const requiredSecretEnvironment = (name: string): string => {
  const value = requiredEnvironment(name);
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters long`);
  }

  return value;
};

const supabaseUrl = requiredEnvironment('SUPABASE_URL');
const adminApiToken = requiredSecretEnvironment('ADMIN_API_TOKEN');

try {
  new URL(supabaseUrl);
} catch {
  throw new Error('SUPABASE_URL must be a valid URL');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://localhost:5174,http://localhost:8443')
    .split(',')
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, ''))
    .filter(Boolean),
  supabaseUrl,
  isProduction: process.env.NODE_ENV === 'production',
  adminSessionCookieName: 'caksa-admin-session',
  adminSessionSecret: requiredSecretEnvironment('ADMIN_SESSION_SECRET'),
  supabaseServiceRoleKey: requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
  googleOAuthClientId: requiredEnvironment('GOOGLE_CLIENT_ID'),
  googleOAuthClientSecret: requiredEnvironment('GOOGLE_CLIENT_SECRET'),
  googleOAuthRedirectUri: requiredEnvironment('GOOGLE_REDIRECT_URI'),
  googleOAuthRefreshToken: requiredEnvironment('GOOGLE_REFRESH_TOKEN'),
  googleDriveFolderIds: {
    curriculumVitae: requiredEnvironment('GOOGLE_DRIVE_CV_FOLDER_ID'),
    essay: requiredEnvironment('GOOGLE_DRIVE_ESSAY_FOLDER_ID'),
    motivationLetter: requiredEnvironment('GOOGLE_DRIVE_MOTIVATION_LETTER_FOLDER_ID'),
    parentPermissionLetter: requiredEnvironment('GOOGLE_DRIVE_PARENT_PERMISSION_FOLDER_ID'),
  },
  googleSheetsSpreadsheetId: requiredEnvironment('GOOGLE_SHEETS_SPREADSHEET_ID'),
  googleSheetsSheetName: requiredEnvironment('GOOGLE_SHEETS_SHEET_NAME'),
  whatsappGroupLink: requiredEnvironment('WHATSAPP_GROUP_LINK'),
  smtpHost: requiredEnvironment('SMTP_HOST'),
  smtpPort: requiredEnvironment('SMTP_PORT'),
  smtpUser: requiredEnvironment('SMTP_USER'),
  smtpPassword: requiredEnvironment('SMTP_PASSWORD'),
  smtpFrom: requiredEnvironment('SMTP_FROM'),
  resendApiKey: requiredEnvironment('RESEND_API_KEY'),
  adminApiToken,
};
