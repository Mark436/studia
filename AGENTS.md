# AGENTS.md

Instructions for AI coding agents working on this repository.

## Project overview

This is a mobile-first academic PWA that lets students quickly access:

- schedule;
- grades;
- student information;
- academic progress;
- notices;
- debt notifications.

Built with React, TypeScript, Vite, `vite-plugin-pwa`, and `sith-api-client`.

The app should feel like a personal mobile app, not an institutional admin portal. Prioritize speed, clarity, and mobile-first UX.

### Current status

Core product functionality (auth, schedule, grades, student, persistence, pull-to-refresh) is implemented under `src/`; PWA configuration (`vite-plugin-pwa`, manifest, service worker) and several roadmap polish items are still pending — see [`ROADMAP.MD`](ROADMAP.MD). Follow the target architecture below when adding code.

---

## Dev environment

- Use **pnpm** for package management. Do not use npm or yarn.
- Run commands from the repository root.
- Frontend environment variables use the `VITE_` prefix (for example, `VITE_API_URL`). Anything exposed through `import.meta.env` is public.
- `sith-api-client` is a **runtime** dependency. Do not move it to `devDependencies`.
- Do not modify `.js` extensions in `sith-api-client` imports; the package uses ES modules with explicit extensions.
- Create directories and files only when a feature actually needs them. Do not scaffold empty architectural folders.

### Setup

```bash
pnpm install
```

Copy or create a `.env` file when API configuration is needed:

```env
VITE_API_URL=
```

For `pnpm dev` under Codespaces (or any non-`netlify dev` local run), use the
dev-server proxy from `vite.config.ts` so the browser hits a same-origin path:
`VITE_API_URL=/api/sith` (proxy: `/api/sith` → `http://sith.ith.mx/XTodo/wr`,
dev-only). Production uses the same relative path served by the Netlify
Function `netlify/functions/sith-proxy.mts`. With `VITE_API_URL` empty the
client calls the official HTTP endpoint directly, which browsers block with
CORS/mixed-content when the app is served over HTTPS (e.g. Codespaces URLs).

---

## Commands

| Command        | Purpose                                   |
| -------------- | ----------------------------------------- |
| `pnpm dev`     | Start the Vite dev server with HMR        |
| `pnpm build`   | Typecheck (`tsc -b`) and production build |
| `pnpm lint`    | Run Oxlint                                |
| `pnpm preview` | Serve the production build locally        |

There is no test script yet. When tests are added, run them before finishing a task. Until then, run `pnpm lint` and `pnpm build` to verify changes.

---

## Source of truth

Before making significant changes, read the relevant sections of:

| Document                                       | Contents                                         |
| ---------------------------------------------- | ------------------------------------------------ |
| [`docs/product.md`](docs/product.md)           | Product behavior and UX requirements             |
| [`docs/architecture.md`](docs/architecture.md) | Architecture and code organization               |
| [`docs/design.md`](docs/design.md)             | Design system: tokens, typography, capsule, motion |
| [`ROADMAP.MD`](ROADMAP.MD)                     | Current implementation status and task checklist |

If an implementation decision conflicts with product or architecture documentation, stop and reassess before proceeding.

`CLAUDE.md` redirects here. This file is the canonical agent instruction document.

---

## Project structure

Lightweight feature-based architecture:

```text
src/
├── app/                  # Application composition, navigation config, shell wiring
├── components/
│   ├── ui/               # Generic visual primitives (Button, Card, Toast, …)
│   └── layout/           # AppShell, Page, BottomNavigation, usePullToRefresh
├── features/
│   ├── auth/
│   ├── schedule/
│   ├── grades/
│   ├── student/
│   └── devtools/         # Gated testing panel (see ROADMAP §13)
├── lib/
│   ├── api/              # SithClient configuration and API layer
│   ├── storage/          # IndexedDB / persistence services
│   ├── devtools/         # Simulated clock service
│   ├── notifications/    # Local adeudo notifications (opt-in seam)
│   └── biometrics/       # WebAuthn/passkeys (future)
└── main.tsx
```

Domain DTO types come from `sith-api-client` (re-exported via `lib/api/client.ts`); feature-local types live in `features/<feature>/types.ts`. Do not create a shared `types/` or `styles/` directory unless a real need appears.

A feature may contain `components/`, `hooks/`, `types.ts`, `utils.ts`, `service.ts`, and `FeaturePage.tsx` — but only what it actually needs.

### Where new code belongs

| Responsibility           | Location              |
| ------------------------ | --------------------- |
| Feature-specific code    | `features/<feature>/` |
| Generic visual primitive | `components/ui/`      |
| Application layout       | `components/layout/`  |
| Shared infrastructure    | `lib/`                |
| Application composition  | `app/`                |

Keep code as close as possible to the functionality that owns it.

---

## Code style

### TypeScript

- Use strict TypeScript. Do not weaken compiler configuration to bypass errors.
- Do not use `any` unless there is a genuinely unavoidable external boundary; document the reason when necessary.
- Prefer inferred types when obvious; use explicit types for public APIs and domain boundaries.
- Reuse types from `sith-api-client` instead of duplicating them.

### Exports and imports

- Use **named exports** throughout. Avoid default exports unless a framework requires them.
- Use the `@` alias for internal imports once configured:

```ts
import { Card } from "@/components/ui/Card";
import { SchedulePage } from "@/features/schedule/SchedulePage";
```

- Use normal package imports for external dependencies:

```ts
import { SithClient } from "sith-api-client";
```

### General principles

- Prefer simple, explicit solutions over unnecessary abstractions.
- Keep components and modules focused.
- Do not refactor unrelated code while implementing a task.
- Do not change documented product behavior without reconsidering the requirement.
- Do not split code into tiny abstractions without a clear benefit.

### Component design

Components should be small and focused. Avoid a single component that simultaneously fetches API data, manages authentication, writes to IndexedDB, calculates schedule state, and renders an entire page.

Prefer:

```text
Page → Hook / state → Domain logic → Feature components → Shared UI
```

Keep business logic out of JSX when it becomes non-trivial. Prefer pure functions for calculations.

---

## Architecture rules

### Dependency direction

```text
App (pages / routing)
  ↓
Features (auth / schedule / grades / student)
  ↓
Shared UI + lib (api / storage / biometrics)
  ↓
Browser / Academic API
```

Avoid circular dependencies between features (for example, `schedule → grades → schedule`). Features may depend on shared UI, shared infrastructure, application-level state, and their own modules.

### Shared UI (`components/ui/`)

Generic visual building blocks only: `Button`, `Card`, `Badge`, `ProgressBar`, `Input`, `Spinner`, etc.

These must **not** know about academic concepts. Do not put `StudentProgressCard`, `ScheduleClassCard`, or `GradeSummary` here — those belong in their features.

Do not extract a component to shared UI until it is genuinely generic and used by multiple unrelated features.

### Layout (`components/layout/`)

Application structure: `AppShell`, `Page`, `PageHeader`, `BottomNavigation`. May handle safe areas and responsive layout. Must not contain feature-specific business logic.

### API integration

Centralize API client creation in `src/lib/api/`. React components must **not** instantiate `SithClient` directly.

```text
Component → Feature hook/service → API layer → SithClient → Academic API
```

Do not reimplement functionality already provided by `sith-api-client`.

### Application data

Treat academic information as a single coherent data set. Do not make Schedule, Grades, Student, Notices, and Debts independently request the same data if `fetchDatos()` already provides it together.

```text
SithClient → AppData → Schedule / Grades / Student / Notices / Debts
```

Maintain one source of truth for currently loaded academic data. Features consume that state rather than fetching independently.

Conceptual shape (follow actual `sith-api-client` types):

```ts
interface AppData {
  alumno: Student;
  horario: Schedule;
  calificaciones: Grades;
  avisos: Notice[];
  adeudos: Debt[];
  progreso: Progress;
  loadedAt: string;
}
```

### Data persistence

Storage belongs in `src/lib/storage/`. Components must not access IndexedDB directly.

```text
Feature / application state → Storage service → IndexedDB
```

- Persist academic data with enough metadata (for example, `loadedAt`) to determine freshness.
- A failed refresh must **not** delete previously valid data.
- Show stale/offline states when appropriate.

Startup flow:

```text
Load cached AppData → Render immediately → Fetch on login / pull-to-refresh → Replace cache
```

Automatic refresh at launch is planned but not implemented (ROADMAP §11). If the
network request fails, cached data remains visible with an appropriate stale/offline
indicator.

### Refresh behavior

The primary refresh mechanism is **pull-to-refresh**. Do not add a prominent "Actualizar" button unless product requirements explicitly change. A discreet, non-gesture refresh action (currently in the Student area) is the required accessible alternative — do not remove it on gesture-independence grounds.

One coherent refresh operation for all academic data:

```text
Pull to refresh → Refresh AppData → SithClient → Update state → Persist → All screens update
```

Prevent concurrent refresh operations. Individual pages must not each implement their own refresh request.

### Home screen

Implement this rule once; navigation consumes application state:

```text
Unseen grade changes AND period average ≠ 0?
  ├── yes → Grades is Home
  └── no  → Schedule is Home
```

The decision lives in `shouldOpenGradesFirst()` (`features/grades/utils.ts`), consumed once by `app/App.tsx`. Do not duplicate this logic across components.

### Loading and error states

Every major feature should handle relevant states: `loading`, `success`, `empty`, `error`, `offline`, `stale`.

Do not expose raw API errors to users. Translate failures into understandable UI states.

---

## Feature guidelines

### Schedule (`features/schedule/`)

- Default view: today's schedule as a vertical timeline.
- Priority order: current class → next class → later classes.
- Completely finished classes must not appear in the contextual view of the current day.
- The current class stays visible after it starts; show visual progress.
- Show a current-time indicator; update when the relevant minute changes, on foreground return, or on day change.
- Keep schedule calculations in pure functions outside JSX:

```text
getCurrentClass()
getNextClass()
getVisibleClasses()
getClassProgress()
getScheduleForDay()
```

- Swipe navigation between days belongs to the schedule feature. Swipe must not be the only way to change days — provide an accessible alternative.
- Two-day view is out of scope for the initial MVP unless explicitly requested.

### Grades (`features/grades/`)

- Show appropriate empty state when no grades exist; the app remains functional and Schedule is Home.
- Grades becomes Home only with unseen grade changes and a non-zero period average (see "Home screen" above).

### Student (`features/student/`)

- Show student info, career info, and academic/credit progress.
- Do not dump every API field — only information with product value.

### Notices and debts

- Part of the academic data model; not separate top-level navigation items.
- Debts primarily trigger a visible alert when data is loaded.
- Do not redesign navigation around debts unless product requirements change.

### Authentication (`features/auth/` + `lib/`)

- Authentication UI in `features/auth/`; infrastructure in `lib/`.
- Session mechanism depends on `sith-api-client` and backend capabilities.
- Do not assume browser storage replaces a real authentication/session mechanism.

### Biometrics / passkeys (future)

- Do not implement biometric login by saving the user's password.
- Prefer WebAuthn/passkeys if the backend supports it. Infrastructure may live in `lib/biometrics/`.
- Not required for the first functional version unless explicitly requested.

### PWA

- Configured at the Vite/build level with `vite-plugin-pwa`.
- Features should not depend on whether the app runs as an installed PWA vs. a browser tab unless necessary.

### Responsive design

Mobile-first. Primary experience is phones; must also work on tablets and desktop. Prefer responsive layouts over separate mobile/desktop implementations.

### Accessibility

Gestures must not be the only way to access important functionality. Ensure accessible names, visible focus states, sufficient touch targets, semantic HTML, and keyboard navigation where applicable.

---

## Security

### Passwords and credentials

**Never persist the user's password.** Do not store passwords in:

- `localStorage`
- `sessionStorage`
- `IndexedDB`
- persistent cookies
- custom or encrypted browser storage intended to recover the original password

Encryption does not make password persistence acceptable. Do not silently introduce password persistence as a login shortcut.

### Environment variables

Never put passwords, API secrets, private keys, or server credentials in frontend environment variables. They are configuration, not a security mechanism.

---

## Testing

There is no test runner configured yet. When tests are added:

- Pure business logic (for example, `getCurrentClass()`, `shouldOpenGradesFirst()`) should be testable without rendering React.
- Keep API integration tests separate from pure domain logic where practical.
- Do not introduce a large testing architecture unless the project needs it.

Until tests exist, verify changes with:

```bash
pnpm lint
pnpm build
```

---

## Workflow

### Before implementing a task

1. Read the relevant section of `docs/product.md`.
2. Read the relevant section of `docs/architecture.md`.
3. Check `ROADMAP.MD`.
4. Inspect the existing implementation before creating new abstractions.
5. Determine the smallest set of changes required.
6. Avoid modifying unrelated code.

If the request conflicts with existing architecture or product decisions, explain the conflict before making a large change.

### After implementing a task

1. Review modified files and remove unused code/imports.
2. Verify TypeScript types compile.
3. Run `pnpm lint` and `pnpm build`.
4. Run relevant tests when available.
5. Update `ROADMAP.MD` if the task corresponds to a roadmap item.
6. Do not update documentation with speculative information.

### Architectural decision rule

When choosing between valid implementations, prefer the option that:

1. is simpler;
2. keeps code close to its feature;
3. introduces fewer dependencies;
4. preserves strong typing;
5. avoids duplicated state;
6. is easy to test;
7. can be changed later without affecting unrelated features.

Do not choose an abstraction simply because it is a common pattern.

---

## Priority rules

These rules take precedence when making implementation decisions:

- Do not store user passwords persistently.
- Do not duplicate types already provided by `sith-api-client` without a reason.
- Do not instantiate `SithClient` directly inside presentation components.
- Do not make individual screens independently fetch the same academic data.
- Do not add a traditional refresh button when pull-to-refresh is sufficient.
- Do not make swipe gestures the only way to access important functionality.
- Do not put feature-specific components in `components/ui/`.
- Do not create architectural folders that are not needed.
- Do not introduce unnecessary dependencies.
- Do not use default exports without a specific reason.
- Do not use `any` to bypass type errors.
- Do not modify unrelated parts of the application while implementing a task.
- Do not change documented product behavior without first reconsidering the requirement.
