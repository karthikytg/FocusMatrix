# FocusMatrix

Eisenhower Productivity & Task Management System, designed to run locally and offline.

## Current status

The current vertical slice includes a responsive dashboard, local task creation/completion/reopen, Eisenhower quadrant classification, due dates, local reminders, recurring reminder scheduling, navigation views, local profile names, optional Supabase authentication, and a portable Electron desktop build.

The larger product brief is not fully implemented. Projects, habits, full calendar interactions, advanced analytics, backup/restore, import/export, cloud task synchronization, and the complete automated test suite remain future work.

## Development

```bash
npm install
npm run dev
```

Build the current application with:

```bash
npm run build
```

## Standalone Windows app

Install dependencies and create the portable desktop build:

```bash
npm install
npm run desktop:portable
```

Run `FocusMatrix-standalone/FocusMatrix.exe`. The folder is self-contained and does not require Node.js, Vite, or a browser. User data remains local to the Electron profile.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design and implementation phases.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment and DigitalOcean](docs/DEPLOYMENT.md)
- [Security and privacy](docs/SECURITY.md)

## Privacy

The intended runtime is local-first. No cloud account, analytics, advertising SDK, or external database is part of the design.

## Optional sign-in

Supabase authentication is optional. Without configuration, FocusMatrix remains offline-only. To enable Google OAuth and email account creation:

1. Create a Supabase project.
2. Enable Google and/or email providers in Supabase Authentication.
3. Add the project URL and browser-safe anonymous key to a local `.env` file using [.env.example](.env.example).
4. Add the app URL to Supabase Authentication URL configuration. For Electron, configure the desktop redirect flow before enabling Google sign-in there.

Never commit `.env` files or service-role keys. Authentication does not sync task data yet; local IndexedDB remains the source of truth.

## CI/CD and DigitalOcean

The repository includes [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml), a Docker image, and a DigitalOcean App Platform spec. Every pull request and push runs install, lint, and production build checks. Pushes to `main` additionally build an immutable Docker image, push it to DigitalOcean Container Registry, and deploy it to App Platform.

Required GitHub configuration:

- Repository secret `DIGITALOCEAN_ACCESS_TOKEN`: a DigitalOcean token with Container Registry and App Platform access.
- Repository variable `DOCR_REGISTRY`: the DigitalOcean Container Registry name.
- Repository variable `DO_APP_ID`: the App Platform app ID.
- Repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if hosted authentication is enabled.

One-time DigitalOcean setup:

1. Create a Container Registry named `focusmatrix` (or update the repository name in `.do/app.yaml`).
2. Create an App Platform app using `.do/app.yaml` and record its app ID.
3. Add the GitHub secrets and variables above.
4. Push to `main`; the workflow deploys the commit SHA as the image tag.

The hosted web app remains local-first: tasks stay in browser IndexedDB. Supabase authentication is optional and does not imply task synchronization.
