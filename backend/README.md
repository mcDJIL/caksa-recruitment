# Recruitment API

## Setup

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and long random values (at least 32 characters) for `ADMIN_API_TOKEN` and `ADMIN_SESSION_SECRET`. Keep all of these values server-only.
3. Set `NODE_ENV=production` and `CLIENT_ORIGIN` to the exact frontend URL(s), comma-separated if needed.
	Example: `CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:8443`.
4. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN` from the Google account that owns the Drive folders. The OAuth consent must grant the Google Drive scope and keep the refresh token server-only.
5. Apply `supabase/migrations/20260824000100_create_recruitment_applications.sql` in the Supabase SQL Editor.
5. Run `npm install` and `npm run dev`.

The service role key must stay on this backend and must never be placed in either frontend. 

If the first migration was already applied, run the second migration instead:
`npx supabase db push`. It removes the old `study_programs.degree_level_code`
column while preserving application data.

The schema is normalized into `degree_levels`, `study_programs`,
`recruitment_batches`, `interested_wings`, and `divisions`. Applications store
the corresponding `*_code` foreign keys instead of repeating labels.

## API

- `GET /api/health`
- `POST /api/applications` accepts multipart form data from the public recruitment form.
- `GET /api/applications/:code` returns the public status for an application code.
- `POST /api/admin-session` exchanges `Authorization: Bearer <ADMIN_API_TOKEN>` for an 8-hour `HttpOnly`, signed session cookie. The raw token is never persisted by the frontend.
- `GET /api/admin-session` checks the current admin session and `DELETE /api/admin-session` clears it.
- `GET /api/applications` lists applications and requires the admin session. Supports query params: `page`, `limit`, `q`, and `status`.
- `GET /api/applications/export` exports filtered applications as XLSX and requires the admin session.
- `PATCH /api/applications/:code/status` updates an application status and requires the admin session.

The migration enables RLS on the applications table and removes direct `anon` and `authenticated` table and storage access. The API performs database and Storage operations with the server-only service role.
