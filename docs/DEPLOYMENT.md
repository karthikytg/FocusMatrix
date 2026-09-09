# Deployment Guide

## Deployment model

FocusMatrix is a static Vite application served by Nginx. The production Docker image builds the React bundle in Node.js and serves `dist/` from Nginx. The Nginx configuration includes SPA fallback so future client-side routes can resolve to `index.html`.

The application has no server-side task API. Tasks remain in browser IndexedDB, including when the app is hosted on DigitalOcean.

## GitHub Actions

The workflow at `.github/workflows/ci-cd.yml` runs on pull requests, pushes, and manual dispatches:

1. Install with `npm ci`.
2. Run `npm run lint`.
3. Run `npm run build`.
4. On a push to `main`, authenticate to DigitalOcean.
5. Build and push an image tagged with the commit SHA.
6. Update the DigitalOcean App Platform app to that immutable image tag.

Deployment only runs after the CI job succeeds.

## DigitalOcean prerequisites

Create:

- A DigitalOcean Container Registry.
- A DigitalOcean App Platform app configured for the image in `.do/app.yaml`.
- A DigitalOcean API token with the minimum Container Registry and App Platform permissions needed by the workflow.

Configure GitHub repository settings:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `DIGITALOCEAN_ACCESS_TOKEN` | DigitalOcean API token |
| Variable | `DOCR_REGISTRY` | Container Registry name |
| Variable | `DO_APP_ID` | App Platform application ID |
| Secret | `VITE_SUPABASE_URL` | Optional Supabase project URL |
| Secret | `VITE_SUPABASE_ANON_KEY` | Optional browser-safe Supabase key |

Use the `production` GitHub environment for deployment protection and approval rules.

## First deployment

1. Push the repository to GitHub.
2. Ensure the default branch is `main`.
3. Add the variables and secrets above.
4. Confirm the App Platform spec references the correct registry and repository.
5. Push a small change to `main` or run the workflow manually.
6. Confirm the App Platform health check returns the site.

## Local Docker validation

Docker is required for this check:

```bash
docker build --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" -t focusmatrix:local .
docker run --rm -p 8080:80 focusmatrix:local
```

Open `http://localhost:8080/` and verify the dashboard, a direct refresh, and the browser console.

## Rollback

App images are tagged with commit SHAs. To roll back, update App Platform to a previous known-good SHA image and redeploy. Keep the previous image in the registry until the rollback window has passed.

## Supabase redirect configuration

For hosted web authentication, add the production HTTPS URL and local development URL to Supabase Authentication redirect settings. Electron uses a local file origin and needs a separate desktop OAuth strategy before Google sign-in is enabled there; the current auth code is ready for web redirects, but desktop OAuth redirect handling is not complete.
