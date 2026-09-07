# Architecture

Studia is a mobile-first academic PWA for students. It lets a logged-in student
see their schedule, grades, profile, notices, and debt alerts without navigating an
institutional portal. Data comes from the academic API through `sith-api-client`; the
frontend owns presentation, caching, and refresh orchestration.

Core product functionality (auth, schedule, grades, student, persistence,
pull-to-refresh, PWA shell) is implemented under `src/`; automatic refresh at
launch, several UX polish items, and roadmap tasks are still pending — see
[`ROADMAP.MD`](../ROADMAP.MD).

## Bird's Eye View

The student opens the app. If a valid session exists, cached academic data loads from
local storage and renders immediately. Fresh data is fetched through a single
`AppData`-shaped load on login and via pull-to-refresh; automatic refresh at launch is
planned but not implemented (ROADMAP §11). If there is no cached session, the auth
feature collects credentials and triggers the first load.

```txt
Login → SithClient.fetchDatos → AppData → persist → Schedule / Grades / Student UI
                ↑
         pull-to-refresh (one operation for all screens)
```

All academic screens consume the same in-memory `AppData` snapshot. Schedule, Grades,
and Student do not each call the API independently. Notices and debts are part of
`AppData` and surface as alerts or inline content, not as separate top-level navigation
tabs.

Navigation picks the home screen once per launch: Grades opens first only
when local grade tracking reports unseen changes and the period average is
non-zero (`shouldOpenGradesFirst`); otherwise Schedule is Home.

## Code Map

This section describes the high-level structure of the codebase. Pay attention to
**Boundary** and **Invariant** callouts.

### `src/main.tsx`

Application entry point. Mounts React in strict mode and renders the root `App`
component.

**Invariant:** Contains no feature logic, routing rules, or API calls.

### `src/app/`

Application composition: routing, navigation config, global providers, and the
decision of which feature is Home. Key modules: `App.tsx`, `navigation.tsx`.

**Boundary:** Features are mounted here; `app/` coordinates them but does not
implement schedule calculations, grade formatting, or login form details.

**Invariant:** Home selection (`shouldOpenGradesFirst(alumno, unseenGradeChanges)`
→ Grades or Schedule) is implemented once here (or in a single shared helper
consumed here), not duplicated in feature pages.

### `src/components/ui/`

Generic visual primitives with no academic domain knowledge. Examples: `Button`,
`Card`, `Badge`, `ProgressBar`, `Input`, `Spinner`.

**Boundary:** UI components speak in props (`value`, `label`, `onClick`), not in
`Alumno`, `Boleta`, or schedule concepts.

**Invariant:** No API calls, no IndexedDB access, no imports from `features/`.

### `src/components/layout/`

Application shell and page structure. Examples: `AppShell`, `Page`, `TopZone`,
`BottomNavigation`.

Handles safe areas and mobile layout. Wires navigation slots; does not fetch data or
decide which class is current.

**Invariant:** Layout components never contain feature-specific business rules
(for example, hiding finished classes or computing grade averages).

### `src/features/auth/`

Login, logout, and session UX. Key concepts: authenticated vs unauthenticated state,
loading and error presentation for credential submission.

**Boundary:** Auth UI lives here; session infrastructure (how credentials reach
`SithClient`) lives in `lib/`.

**Invariant:** The user's password is never persisted in `localStorage`, `sessionStorage`,
IndexedDB, or cookies. Biometric shortcuts must not store the password, even encrypted.

### `src/features/schedule/`

Today's schedule as a vertical timeline: current class, next class, later classes.
Key pure helpers: `getCurrentClass`, `getNextClass`, `getVisibleClasses`,
`getClassProgress`, `getScheduleForDay`. Key UI: `SchedulePage`,
`ScheduleDayView`, `ClassCard`, `CurrentTimeIndicator`.

**Invariant:** Date/time and "which class is active" logic lives in pure functions or
hooks, not scattered through JSX.

**Invariant:** Swipe between days is schedule-specific and must have a non-gesture
alternative — provided by the three-dot day menu (`DayDots`), which also always
keeps the selected day centered (infinite window).

**Invariant:** Completely finished classes do not appear in the contextual view of
the current day; the in-progress class stays visible with progress.

### `src/features/grades/`

Grade summary and per-subject listing. Key concepts: empty state when no grades
exist, new/changed badges via local `TrackedGrade` records, loading/error/offline
states. Helper: `shouldOpenGradesFirst`.

When there are unseen grade changes to review (and the period average is
non-zero), this feature becomes the default Home screen.

**Invariant:** Grades reads from shared `AppData`; it does not call `SithClient`
directly.

### `src/features/student/`

Student profile and academic progress: name, career, semester, credit progress.
Shows only fields with product value, not every API field.

**Invariant:** Reuses types from `sith-api-client` (`Alumno`, `Creditos`, etc.)
rather than duplicating DTO shapes.

### `src/features/settings/`

Always-on user preferences surfaced as a bottom sheet opened from the Student
area. Owns `UserSettings` (notification channel, capsule auto-collapse,
long-press duration) and the adeudo-alerts switch.

- `types.ts` — `UserSettings` shape, defaults, and `parseUserSettings` validation.
- `useSettings.ts` — `SettingsController` (load/persist via `lib/storage`, one-time
  migration from the legacy `DevConfig` user-facing fields).
- `components/SettingsSheet.tsx` — the bottom-sheet UI using generic primitives
  (`Switch`, `SegmentedControl`, `Slider`, `Button`).

**Invariant:** These preferences apply regardless of dev mode. Developer
simulation overrides (clock, materias, grades, debts, toast test duration)
stay in `features/devtools`/`DevConfig`.

### `src/features/devtools/`

Gated testing panel (ROADMAP §13): simulated clock, schedule/grade/debt
overrides, and toast previews. Unlocked with a tap gesture in production;
visible by default in dev builds. Closing the panel persists an explicit
disabled flag, pauses simulation, and keeps the saved config.

**Invariant:** Simulation is presentation-only — `applyDevOverrides` builds a
virtual `Alumno` for rendering; fetches, persistence, grade tracking, and
adeudo alerts always use real data.

### `src/lib/devtools/`

Simulated clock service (`getNow`, `setClockOffsetMinutes`,
`subscribeToClock`) consumed by time-dependent UI so dev tools can shift the
app's notion of "now" without touching system APIs.

### `src/lib/api/`

Central place to configure and expose the academic API client. Key concept: a shared
`SithClient` instance (or thin wrapper) used by application-level data loading.

**Boundary:** This is the only layer that instantiates `SithClient`. React components
and feature pages call hooks or services above this layer.

**Invariant:** Feature components never construct `SithClient` inline.

### `src/lib/storage/`

IndexedDB persistence for the app cache and small settings. Three stores:

- `app-data` — last valid academic snapshot (`CachedAppData`: `alumno`, `avisos`, `loadedAt`);
- `grade-tracking` — per-subject `TrackedGrade` (`current` vs `previous`) so the grades feature can mark new or changed grades;
- `settings` — non-sensitive preferences: remembered username, adeudo-alerts
  opt-in, grades-seen flag, last login timestamp (drives the 23h stale-data
  nudge), last reminder date, dev-tools simulation config, and the
  always-on `userSettings` blob (see `features/settings`).

A fourth store, `schedule-edits`, holds the user's schedule customization
overlay: per-subject text overrides, per-occurrence time moves, manually
added subjects (`USR-*` claves), weekly conflict preferences, drift
baselines (`fieldSnapshots`), and unresolved reconciliation prompts
(`pendingConflicts`). All of it is wiped on logout.

The restore flow lives in `features/auth/AuthProvider.tsx`: cached data hydrates
the session before any network activity, and a successful login overwrites the
snapshot atomically.

**Boundary:** Components and features go through a storage service, not raw
IndexedDB APIs.

**Invariant:** A failed network refresh does not delete previously valid cached data.

**Invariant:** Passwords and long-lived credential secrets are never written here;
only the username is remembered.

**Invariant:** The edit overlay never mutates API data. Fetched schedules are the
base layer; overrides apply on top at render time, so a fresh fetch can always be
re-reconciled against stored baselines (`features/schedule/drift.ts`).

### `src/lib/notifications/`

Local notification infrastructure. Owns permission management and exposes
entry points that share one opt-in and permission gate: `notifyNewAdeudos(previousAlumno, nextAlumno)`
fires an adeudo alert only on a clean→indebt transition, and `notifyCareerProgress(delta)`
fires when academic progress increases between real fetches. Both dispatch via the
service worker registration with distinct tags so repeats coalesce.
Future server-push support implements the same seams without touching features.

**Invariant:** Features never touch the Notification or ServiceWorker APIs directly.

### `src/lib/biometrics/`

Future WebAuthn/passkey integration for returning users. Separate from auth UI in
`features/auth/`.

**Invariant:** Does not implement "remember password" or encrypted password storage.

### Domain types (no separate directory)

There is no shared `src/types/` folder. Domain DTO types come from
`sith-api-client` and are re-exported through `lib/api/client.ts`; the
app-level snapshot type `CachedAppData` (`alumno`, `avisos`, `loadedAt`)
lives in `lib/storage/appDataStore.ts`; feature-local types live in
`features/<feature>/types.ts`.

The conceptual "AppData" — one coherent snapshot feeding every screen — maps
onto the package's `Alumno` graph (identity, boleta, horario, adeudos,
progreso) plus the separate `avisos` list:

```txt
fetchDatos() → { alumno: Alumno, avisos: Aviso[] }
Alumno ⊇ boleta (grades) + horario (schedule) + adeudos + progreso
```

Exact field types follow `sith-api-client` exports. As of `sith-api-client`
2.3.0, `progreso` is a plain `number` and `horario` carries raw per-day time
strings that the schedule feature parses — see [`api.md`](api.md).

**Invariant:** Prefer API package types over local duplicates unless the UI model
genuinely differs.

### `sith-api-client` (external)

Runtime dependency that talks to the academic API. Key type: `SithClient`. Primary
method: `fetchDatos(credenciales)` returning `DatosAlumno` (`alumno` + `avisos`);
grades, debts, progress, and the weekly schedule (`horario`) are mapped into the
alumno graph — see [`api.md`](api.md).

**Boundary:** The package owns HTTP, parsing, and DTO mapping. The PWA owns when to
fetch, how to cache, and how to present data.

**Invariant:** Do not reimplement API communication that the package already provides.
Keep `.js` extensions in package import paths as required by its ESM build.

See [`api.md`](api.md) for the request lifecycle, error `cause` shapes, and known gaps.

## Cross-Cutting Concerns

### Error Handling

API and storage failures are translated into UI states: `loading`, `success`, `empty`,
`error`, `offline`, `stale`. Raw API errors are not shown to users. When refresh fails
but cache exists, cached data stays visible with a stale/offline indicator.

### Testing

Vitest is configured (`pnpm test`). It focuses on pure domain logic that can
run without rendering React:

- `getCurrentClass`, `getNextClass`, `getVisibleClasses`, `getClassProgress`
- `shouldOpenGradesFirst`, home-selection logic
- schedule conflict resolution, edit persistence, drift reconciliation, capsule state

API integration and UI behavior are kept separate from schedule math where
practical.

### Configuration

Public frontend config uses Vite `VITE_` variables (for example, `VITE_API_URL`).
These values are visible in the bundle and must not hold secrets.

Build tooling: Vite, TypeScript (strict), Oxlint. PWA manifest and service worker
live at the Vite/build layer via `vite-plugin-pwa` (`autoUpdate`; `registerSW` in
`src/main.tsx`), not inside features.

### Refresh and Concurrency

One application-level refresh updates all of `AppData`, persists the result, and
lets every screen re-render. Pull-to-refresh is the primary manual refresh mechanism.
Concurrent refresh operations are prevented.

Startup flow: load cache → render immediately; fresh data is fetched on login and
via pull-to-refresh, replacing the cache on success. Automatic refresh at launch
remains a pending roadmap item (ROADMAP §11).

### Styling and Responsiveness

Mobile-first. Global tokens, reset, and typography in shared styles; feature components
handle feature-specific layout. The layout layer owns shell-level responsive behavior.
