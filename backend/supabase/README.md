# Supabase security setup

The backend uses the Supabase Data API through `@supabase/supabase-js`.

Before exposing recruitment tables:

1. Enable RLS on every exposed table.
2. Create policies for the exact user and recruiter roles that need access.
3. Grant only the required table or function privileges to `anon` and `authenticated`.
4. Keep internal tables in a private schema or use a dedicated exposed `api` schema.
5. Use a publishable key for normal RLS-protected operations. Use a secret key only for explicitly authorized server-only admin operations.
6. Generate `database.types.ts` from the deployed schema and pass it to `createClient` for type-safe queries.

Do not put `SUPABASE_SECRET_KEY`, `service_role`, database passwords, or other privileged credentials in frontend environment variables or source control.