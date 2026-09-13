# Dev/Test Mock API System - Changes Summary

> **Actualización (2026-09-12):** el modo dev se consolidó en una sola vía. Se
> eliminó el sistema de overrides de presentación (`applyDevOverrides`), los
> botones existentes del panel ahora **mutan el estado mock** y el toggle de
> API queda **hasta arriba** del panel. La explicación completa de cómo
> funciona ahora está en **`docs/modo-dev.md`**.

## Overview
Implemented a complete Dev/Test mock API system that allows simulating a full isolated session in dev mode. The system uses identical interfaces to production, has zero impact on production, and provides per-API toggles with mutable mock state.

---

## New Files Created

### Core Infrastructure (`src/lib/devtest/`)

| File | Purpose |
|------|---------|
| `interfaces.ts` | TypeScript interfaces: `SithApi`, `Clock`, `DevTestEnvironmentInterface` |
| `environment.ts` | `DevTestEnvironment` singleton - central controller for mock state, config, activation |
| `provider.tsx` | React Context: `DevTestProvider` + hooks `useSithApi()`, `useClock()`, `useDevTestEnvironment()` |
| `real/SystemClock.ts` | Wraps existing `getNow()` as `Clock` implementation |
| `real/RealSithApi.ts` | Wraps existing `fetchAppData()` as `SithApi` implementation |
| `mock/FakeClock.ts` | Deterministic clock with `advance()`, `setDate()`, `setOffset()` |
| `mock/TestSithApi.ts` | Returns mutable mock state for `fetchDatos()` |

---

## Modified Files

### API Layer
- **`src/lib/api/client.ts`**: Added optional `SithApi` parameter to `fetchAppData()` with default to real API. Exported `SithApi` interface and `setDefaultSithApi()`.

### Authentication
- **`src/features/auth/AuthProvider.tsx`**: Uses `useSithApi()` for login/refresh. Passes `clock.getNow()` to persistence.

### App Root
- **`src/app/App.tsx`**: Wraps `AuthProvider` with `DevTestProvider`. Uses `useClock()` for stale nudge and test notifications.

### Clock Migration (All time sources → `useClock().getNow()`)

| File | Changes |
|------|---------|
| `src/features/schedule/SchedulePage.tsx` | `getNow()` → `clock.getNow()` for selected date init/reset |
| `src/features/schedule/components/ScheduleCapsule.tsx` | `Date.now()` → `clock.getNow().getTime()` for pulse keys |
| `src/features/student/components/ReinscripcionCard.tsx` | `getNow()` → `clock.getNow()` |
| `src/lib/devtools/useCurrentTime.ts` | Rewritten to use `useClock()` instead of `subscribeToClock` |
| `src/lib/useHorariosCheck.ts` | `getNow()` → `clock.getNow()`; passes clock to `ejecutarChequeoHorarios` |
| `src/lib/datosCalendario.ts` | Added `clock` parameter to `obtenerDatosCalendario()` |
| `src/lib/calendarioLabores.ts` | Added `currentYear` parameter to `extraerFechasInicioLabores()`, `extraerFechasPublicacionPrehorarios()`, `leerFechasInicioLabores()` |
| `src/lib/notifications/reinscripcion.ts` | `notifyNewReinscripcion()` now accepts `now: Date` parameter |

### Dev Panel & Config
- **`src/features/devtools/DevPanel.tsx`**: Added API Mode toggle (Real/Mock), mock data editors for alumno fields, grades, adeudos, avisos
- **`src/features/devtools/useDevConfig.ts`**: Integrates with `DevTestEnvironment` - `activate()`/`deactivate()` on enable/disable, `reset()` on restore
- **`src/features/devtools/components/ClockSection.tsx`**: Uses `useClock()` instead of `useCurrentTime`
- **`src/features/devtools/components/MateriasSection.tsx`**: Uses `useClock()` for unique clave generation
- **`src/features/devtools/components/ReinscripcionSection.tsx`**: sets the mock reinscription date via relative presets or exact picker; the alert/tarjeta is tested by crossing it with the simulated clock
- **`src/features/devtools/components/PruebaCompletaSection.tsx`**: Passes `currentYear` to `leerFechasInicioLabores()`

### Tests
- **`src/lib/calendarioLabores.test.ts`**: Updated all test calls to pass `currentYear` parameter

---

## Key Features

### 1. Per-API Toggle
- Dev Panel shows "API Mode" segmented control: **Real** / **Mock**
- Only Sith API mocked for now (Documents API deferred)

### 2. Mutable Mock State
- Mock state initialized from cached `AppData` on `activate()`
- Editable fields in Dev Panel:
  - Alumno: nombre, número de control, carrera, semestre
  - Grades: per-materia input
  - Adeudos: per-area text + tieneAdeudos checkbox
  - Avisos: "Add test aviso" button
- Mutations: `updateGrade()`, `setAdeudos()`, `addAviso()`, `setMockAppData()`

### 3. Fake Clock as Sole Time Source
- When Mock mode active, `useClock()` returns `FakeClock`
- All time-dependent UI (schedule, countdowns, reinscripcion) uses this clock
- Dev Panel clock controls shift `FakeClock` offset

### 4. Real Pipeline Integration
- `TestSithApi.fetchDatos()` returns mutated mock data
- AuthProvider `refresh()` calls `fetchAppData(credentials, sithApi)` → gets mock data
- Grade tracking detects changes → real toast fires naturally
- No presentation-only overrides needed

### 5. Complete Isolation
- `DevTestProvider` mounted at app root (always available)
- Mock only active when Dev Panel enabled
- `deactivate()` on panel close: destroys mock state, resets config to Real, clears clock offset
- Production code path unchanged when panel closed

---

## Verification

```bash
pnpm lint   # ✓ passes (only fast-refresh warnings for provider.tsx)
pnpm build  # ✓ builds successfully
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      DevTestProvider                         │
├─────────────────────────────────────────────────────────────┤
│  DevTestEnvironment (singleton)                              │
│  ├── config: { sith: 'real' | 'mock' }                      │
│  ├── isActive: boolean                                       │
│  ├── mockAppData: CachedAppData | null                       │
│  ├── systemClock: SystemClock                                │
│  ├── fakeClock: FakeClock                                    │
│  ├── realSithApi: RealSithApi                                │
│  └── testSithApi: TestSithApi                                │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       useSithApi()                  useClock()
              │                           │
       ┌──────┴──────┐            ┌──────┴──────┐
       ▼             ▼            ▼             ▼
  RealSithApi   TestSithApi    SystemClock   FakeClock
       │             │            │             │
       │       mock state      real clock   simulated
       │       (from cache)    (getNow)     (offset)
       └─────────────┬───────────────────────┘
                     ▼
              fetchAppData()
                     │
                     ▼
              AuthProvider → Grade Tracking → Toast
```

---

## Usage

1. Open Dev Panel (7 taps on student name in Student tab, or auto-enabled in dev builds)
2. **API toggle at the top**: switch **Sith API** to **Mock**
3. Edit data in the existing sections (Datos del alumno, Materias, Calificaciones, Adeudos, Avisos) — they now mutate the mock state
4. Pull-to-refresh → app fetches from `TestSithApi` → grade tracking detects changes → toast fires
5. Use Clock section to shift time (only while Mock is active) → schedule updates in real-time
6. Close panel → `deactivate()` destroys mock state, restores Real API and the real clock

Full explanation: **`docs/modo-dev.md`**