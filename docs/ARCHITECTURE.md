# FocusMatrix Architecture

## A. System diagram

```text
React pages and feature components
            |
     Zustand UI/session state
            |
   Application services and schemas
      |                 |
  Pure domain logic   Dexie repositories
      |                 |
   IndexedDB (local, versioned, soft-delete)
            |
   Backup/export + service worker cache
```

The browser is the only runtime. No account, server, analytics, or external database is required.

## B. Technology stack

- React 19, TypeScript, Vite
- Tailwind CSS for utility composition with a small token-based CSS layer for the product shell
- Zustand for UI preferences, filters, selection, and transient workflows
- Dexie over IndexedDB for durable local data
- React Hook Form and Zod for forms and boundary validation
- dnd-kit for matrix and calendar interactions
- Recharts, date-fns, Lucide React, and React Router
- Vitest, React Testing Library, and Playwright for verification

## C. Feature-oriented structure

```text
src/
  app/          app providers, routing, error boundaries
  components/   shared UI primitives
  config/       runtime configuration and feature flags
  constants/    stable labels and keyboard bindings
  database/     Dexie schema, migrations, repositories
  features/     tasks, matrix, projects, calendar, habits, analytics
  hooks/        reusable UI and data hooks
  pages/        route-level compositions
  schemas/      Zod input and import schemas
  services/     backup, notifications, import/export, recommendations
  store/        Zustand slices
  types/        domain contracts
  utils/        pure calculations and date helpers
  tests/        shared fixtures and test utilities
```

Business rules remain in `utils` or `services`, never in a presentational component.

## D. Database schema

All entities use UUID identifiers and ISO timestamps. User-facing deletion is soft deletion for tasks and projects.

- `users`: local profile and onboarding state
- `tasks`: title, description, urgency, importance, quadrant, priority, status, dates, estimates, project/category links, recurrence, ordering, audit timestamps
- `projects`: name, description, color, lifecycle status, dates
- `categories`, `tags`: user-defined classification; task tags are stored as UUID references
- `subtasks`: parent task, title, completion state, ordering
- `recurringTasks`: recurrence rule and generation metadata
- `taskHistory`: immutable task state events for analytics and undo support
- `habits`, `habitLogs`: habit definition and daily completion records
- `notifications`: local reminder schedule and delivery state
- `settings`: versioned key/value preferences
- `savedFilters`: named serialized filter definitions

Dexie migrations are additive and preserve unknown fields during import/restore.

## E. Data flow

1. A form validates input with Zod.
2. A feature service applies pure domain rules such as `calculateQuadrant`.
3. A repository writes the transaction to Dexie and records history.
4. Zustand receives the updated view state or invalidates the relevant query.
5. The UI renders from local state and IndexedDB-backed selectors.
6. Export and backup read through repositories, never through component state.

## F. State management

Zustand owns ephemeral state: theme, sidebar, active filters, selected tasks, dialogs, toasts, timer state, and onboarding. Dexie owns durable state. Feature services are the only layer allowed to coordinate multi-table writes.

## G. Security and privacy

Data stays in IndexedDB. Imported JSON/CSV is size-limited, parsed structurally, validated with Zod, and previewed before writes. User text is rendered as text, not HTML. No `eval`, secrets, tracking scripts, or third-party telemetry are used.

## H. Offline and PWA

The production build will register a service worker that precaches the application shell and serves local assets offline. IndexedDB is the source of truth. The manifest will provide install metadata and local icons. Browser notification permission remains optional.

## I. Testing strategy

Pure calculations receive unit tests first. Repository tests use an isolated Dexie database and cover migrations, imports, backups, and large task sets. Feature tests cover create/edit/complete/move/delete flows. Playwright covers the primary matrix, calendar, and recovery workflows at desktop and mobile sizes.

## J. Development phases

1. Foundation and architecture: project shell, tokens, tooling, domain contracts.
2. Data layer: Dexie schema, migrations, repositories, fixtures.
3. Core task engine: tasks, quadrant rules, priority scoring, subtasks, projects, tags.
4. Matrix and task workflows: drag/drop, forms, search, filters, bulk operations.
5. Calendar, dashboard, analytics, habits, and Pomodoro.
6. Notifications, backup/restore, import/export, PWA, onboarding, settings.
7. Accessibility, performance, test hardening, and production documentation.

## K. Complexity estimate

- Foundation and design system: medium
- Database and recovery: high
- Tasks, matrix, projects, tags: high
- Search and saved filters: medium-high
- Calendar and time blocking: high
- Recurrence and notifications: high
- Habits and analytics: medium-high
- Backup/import/export/PWA: high
- Accessibility, performance, and E2E quality: high
