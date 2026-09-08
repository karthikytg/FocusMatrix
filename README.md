# FocusMatrix

Eisenhower Productivity & Task Management System, designed to run locally and offline.

## Current status

Phase 1 is complete: the React + TypeScript + Vite foundation, dependency baseline, responsive product shell, and architecture contract are in place. Task persistence, routing, and the feature workflows described in the product brief are not implemented yet.

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

## Privacy

The intended runtime is local-first. No cloud account, analytics, advertising SDK, or external database is part of the design.
