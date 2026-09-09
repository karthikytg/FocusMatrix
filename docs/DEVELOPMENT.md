# Development Guide

## Requirements

- Node.js 22 or newer
- npm
- Git for source control
- Docker only for local production-image testing

## Install and run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173/`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create `dist/` |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Serve the production build locally |
| `npm run desktop:dev` | Build and launch the Electron app |
| `npm run desktop:portable` | Build `FocusMatrix-standalone/FocusMatrix.exe` |
| `npm run desktop:build` | Attempt an NSIS installer build |

The repository currently has no `test` or `test:e2e` script. Do not describe automated test coverage as complete until those scripts and test suites are added.

## Environment variables

Copy `.env.example` to `.env` only when optional Supabase authentication is needed:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-browser-safe-anon-key
```

Vite embeds `VITE_*` values into the browser bundle. Only use a Supabase publishable/anonymous key. Never use a service-role key in this application.

## Code organization

- `src/App.tsx`: current application composition and local task workflow.
- `src/database/`: Dexie database and schema versions.
- `src/types/`: domain types.
- `src/utils/`: pure date and quadrant rules.
- `src/services/auth.ts`: optional Supabase authentication boundary.
- `electron/`: Electron runtime and portable package builder.
- `docs/`: architecture, user, development, deployment, and security documentation.

## Data behavior

Tasks are stored in IndexedDB database `focus-matrix`. Profile names are stored in local storage under `focusmatrix-display-name`. Clearing browser/Electron site data removes local task data and the local profile. There is currently no task export, backup, or cross-device synchronization workflow.

## Change verification

Before opening a pull request:

```bash
npm run lint
npm run build
```

For desktop changes:

```bash
npm run desktop:portable
```

Close any running `FocusMatrix.exe` before rebuilding the portable folder on Windows.
