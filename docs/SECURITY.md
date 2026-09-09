# Security and Privacy Notes

## Data boundaries

- Task data is stored locally in IndexedDB.
- The hosted static server does not receive task records.
- The optional Supabase client handles authentication only in the current implementation.
- No analytics, advertising, or telemetry SDK is configured.

## Credentials

- `.env` files are ignored by Git.
- Only `VITE_SUPABASE_URL` and the browser-safe anonymous key may be exposed to the frontend.
- Never put a Supabase service-role key, DigitalOcean token, or other secret in source code or a `VITE_*` variable.
- DigitalOcean and Supabase deployment credentials belong in GitHub Actions secrets.

## Browser and desktop protections

The Electron window uses context isolation and disables Node integration in the renderer. The hosted Nginx response includes content-type, referrer, and permissions policy headers.

## Current limitations

- Supabase authentication does not synchronize tasks.
- Notification scheduling runs while the app is open; there is no background worker or server notification service.
- Import/export, backup/restore, account deletion, and remote data deletion are not implemented.
- The app does not yet include a complete automated unit, integration, or E2E test suite.

Review these limitations before presenting the application as a multi-device or compliance-ready system.
