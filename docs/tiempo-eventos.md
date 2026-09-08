# Tiempo y eventos — catálogo completo

> Documento de **revisión** (no es fuente de verdad del producto; eso sigue
> siendo `docs/product.md`). Centraliza **todo mecanismo relacionado con tiempo
> o eventos** que existe hoy en la app (implementado o pendiente), con su
> cadencia, disparador y referencia `archivo:línea`. Incluye la rama
> `test/sugerir-horario` y el resto del producto. Catálogo específico del
> chequeo de documentos: `docs/sugerir-horario.md`.

---

## 0. Dos relojes (importante)

La app usa **dos fuentes de tiempo** a propósito:

| Fuente | Qué es | Usos |
| --- | --- | --- |
| `getNow()` (`src/lib/devtools/clock.ts:16`) | reloj **simulado en modo dev** (`offsetMinutes`); igual al real sin offset | horario, cápsula, **chequeo de documentos**, `useCurrentTime` |
| `new Date()` / `Date.now()` (real) | reloj del sistema | nudge de sesión (día local), `lastLoginAt`, `loadedAt`, ids (`Date.now()`), selector absoluto del reloj dev |

Regla práctica: lo que debe ser **probable con el reloj dev** usa `getNow()`;
lo que es **sesión / persistencia** usa el reloj real. No mezclar.

---

## 1. Reloj simulado y hora minutal (`src/lib/devtools/`)

- `clock.ts` — singleton de módulo `offsetMinutes`, `getNow()`,
  `setClockOffsetMinutes`, `subscribeToClock`. **No se persiste solo**; lo
  persiste `useDevConfig` bajo `SETTING_DEV_CONFIG` (`features/devtools/useDevConfig.ts:145,163,190`).
- `useCurrentTime.ts` — devuelve un `Date` que **solo cambia en el límite de
  minuto**:
  - `MINUTE_MS = 60_000`, `RETRY_FLOOR_MS = 250`, `FOREGROUND_RESYNC_COOLDOWN_MS = 500` (`:4,9,13`).
  - `msUntilNextMinute(now)` self-correcting — **sin `setInterval`**, se
    re-arranca con `setTimeout` cada minuto (`:18-20`, `:32+`).
  - Resincroniza en `visibilitychange` / `pageshow` / `focus` con cooldown de
    500 ms; se **pausa con `document.hidden`** (`:113-115`).
  - Se suscribe al reloj dev: un cambio de offset re-deriva todo y re-arranca el
    timer aunque esté en segundo plano (`:119`).
  - Consumidores: `App.tsx:77`, `SchedulePage.tsx:55`, `ClockSection.tsx:32`.
- `features/devtools/components/ClockSection.tsx` — panel dev: `QUICK_OFFSETS =
  [-60, 15, 60, 1440]` min («-1h», «+15m», «+1h», «+1 día») (`:8-13`); el
  selector absoluto resta `Date.now()` **real** (`:42-50`).

---

## 2. Chequeo diario de documentos (bucle 18:00)

> Lógica pura `src/lib/busquedaHorarios.ts`; integración de navegador
> `src/lib/useHorariosCheck.ts`. Estado persistido en
> `SETTING_HORARIOS_CHECKS_STATE = "horariosChecksState"`.

### Reglas y constantes

| Regla | Valor |
| --- | --- |
| Hora del bucle | `HORA_CHEQUEO = 18` (`busquedaHorarios.ts:8`) — desde las **18:00** (`esHoraChequeo`: `getHours() >= 18`) |
| Ventanas anuales del calendario | `[{ mes: 12, dia: 15 }, { mes: 5, dia: 15 }]` = **15-dic** (ciclo ENE-JUN) y **15-mayo** (ciclo AGO-DIC) (`:24-31`) |
| Espera tras labores (fallback) | `diasTrasLabores = 1` |
| Gate de horas | **no existe**: el bucle vuelve a buscar cada vez que corre a las 18:00; solo avisa lo nuevo |
| Cadencia | 1 vez por día a las 18:00 (si la app está abierta) |

### Máquina de fases (`decidirFase`, `:252-308`)

`antes-buscar-calendario` → `buscar-calendario` → `procesar-calendario` →
`esperar-prehorario` → `buscar-prehorario` → `completado`; y `siguiente-ventana`
cuando arranca una ventana nueva (resetea el estado y arranca el ciclo
siguiente). Fases con acción (`FASES_CON_ACCION`): `buscar-calendario`,
`procesar-calendario`, `buscar-prehorario`, `siguiente-ventana`.

Disparo del prehorario: **fecha de la actividad 5** del calendario
(`fechaPublicacionPrehorarios`); si el PDF no la trae, fallback `labores +
diasTrasLabores` (`objetivoPrehorario`, `:234-249`).

### Disparadores (hook `useHorariosCheck.ts`)

- al **abrir la app** (montaje, con `runOnceRef` anti StrictMode);
- al **volver al primer plano**: `visibilitychange` / `pageshow` / `focus`
  (cooldown `COOLDOWN_MS = 500`);
- al **recuperar la conexión** (`online`);
- **timer que re-agenda el próximo 18:00** (`proximoMomentoChequeo`), piso de
  1000 ms — el bucle sigue vivo mientras la app está abierta (`:203-215`).

### Guardas

- `esHoraChequeo`: antes de las 18:00 **no se toca el API**.
- **Offline**: `if (!navigator.onLine) return` — sin conexión no se busca ni se
  persiste; el listener `online` re-dispara (`:69-72`).

### Avisos que emite

- `CALENDARIO_DISPONIBLE_TOAST` (PDF nuevo), `PREHORARIO_DISPONIBLE_TOAST`
  (prehorario de la carrera nuevo) — 1 vez por archivo.
- `TURNOS_REINSCRIPCION_TOAST` — el mismo día en que la fecha de la actividad 5
  **ya pasó**, **una sola vez** (`avisoTurnosEnviado`); se decide con
  `tocaAvisarTurnosReinscripcion` (`busquedaHorarios.ts:330-338`).
- Variant en `App.tsx:158-161`: `buscar-prehorario` = `success`, resto =
  `neutral`.

### Fuentes

| Publicación | Fuente |
| --- | --- |
| Calendario oficial | `ith.mx/calendario-escolar.html` (PDF incrustado; **cambio de nombre de archivo**) — `obtenerCalendarioOficial()` (`lib/prehorario.ts`) |
| Prehorario de la carrera | listado `ith.mx/documentos/?C=M;O=D` — `obtenerPrehorarios()` + `elegirPrehorarioCarrera()` |

Fechas reales de publicación verificadas: 2026-1 V1 **26-ene-2026** (¡tras el
inicio de labores 7-ene!), V2 04-feb, V2-2 22-abr; 2026-2 V1 **29-may**, V2
12-ago; 2024-1 18-dic-2023; 2023-1 10-ene-2023. No hay patrón estable anual →
búsqueda diaria. El calendario **no anuncia su propia publicación** (se detecta
por cambio de archivo / metadata del PDF / orden del listado).

---

## 3. Nudge de sesión vieja (23 h / 1 vez por día)

`src/app/App.tsx` (`:56-58`, `:165-227`)

- `STALE_SESSION_NUDGE_MS = 23 * 60 * 60 * 1000` (23 h).
- Si `última sesión >= 23 h` y **aún no se avisó hoy** (`SETTING_LAST_REAUTH_PROMPT_DATE`
  vs `toDateKey(today)`), muestra un toast **una vez por día local**.
- Usa el **reloj real** (`new Date()`).
- Si además la fecha de la actividad 5 ya pasó, el nudge muestra
  `TURNOS_REINSCRIPCION_NUDGE_TOAST` en lugar del genérico.
- `lastLoginAt` se escribe en `login()` y **no** en refrescos
  (`features/auth/AuthProvider.tsx:157-159`). Sesión desconocida (primera vez
  tras el cambio): nudges una vez.
- `toDateKey()` = `YYYY-MM-DD` local (`features/auth/utils.ts:4-8`).
- El sheet de re-auth **nunca** se abre solo: solo aparece al hacer
  pull-to-refresh sin credenciales en memoria (`App.tsx:363-366`).

---

## 4. Toasts (duración y disparo)

- `DEFAULT_TOAST_DURATION_MS = 1300` (`components/ui/toastVariants.ts:11`),
  reemplazable en modo dev (`App.tsx:144-147`); dev slider
  `1000..10000` paso 500 (`ToastsSection.tsx:23-25`).
- `Toast.tsx` — dos timers por toast: `hideTimer` a `durationMs` (fade) y
  `closeTimer` a `durationMs + FADE_OUT_MS (200)` (`:7`, `:40-50`);
  `studia-fade-up 0.3s`.
- Notificaciones one-shot por fetch real (base de montaje nunca anuncia):
  calificaciones, deudo, progreso — `App.tsx:233-265`; difusión por canal
  `toast` o `cápsula`.
- Cápsula flash: `DETAIL_STAGE_MS = 2200`, `FLASH_TOTAL_MS = 4200`
  (`components/schedule/ScheduleCapsule.tsx:31-32`).

---

## 5. Horario y cápsula (tiempo minutal)

Lógica pura en `features/schedule/utils.ts` y `capsuleState.ts`; indicador
minutal vía `useCurrentTime` (ver §1).

- `isSameDay`, `dateForWeekday`, `addDays`, `HOUR_MS` (`:9-31`).
- `minutesOf`, `formatMinutes`/`parseMinutes`, `formatRelativeTime` (`:60-146`).
- **Clase actual / siguiente / visibles** con comparaciones estrictas de minuto;
  clases terminadas **no aparecen** en la vista contextual del día
  (`getVisibleClasses` filtra `endMinutes > minutes`) (`:80-113`).
- `getClassProgress` — porcentaje recortado a 0..100 (barra actual, cápsula) (`:115-127`).
- `getFreeGaps` — huecos ≥ `FREE_GAP_MIN_MINUTES = 15` (`:188`, `:211-231`).
- `CAPSULE_TOMORROW_COUNTDOWN_HOURS = 3` (`:46`) — la cápsula de mañana dice
  «en Nh» si faltan > 3 h, si no «mañana HH:MM».
- `buildCapsuleState` (`capsuleState.ts:39-74`) — `empty | in-class |
  upcoming | done`; `getTomorrowFirstMeeting` (`:98-123`).
- `autoCapsuleEvent(previous, current)` (`:131-157`) — cruces de umbral que
  disparan **una vez por clase**: `class-start`, `one-minute` (≤ 1 min),
  `one-hour` (≤ 60 min); la primera observación es silenciosa.
- Pulse en la cápsula: `firedEventsRef` evita repetir el mismo
  `event:clave` (`ScheduleCapsule.tsx:86-97`).
- Colapso automático de cápsula `autoCollapseMs` (default **1500 ms**,
  `components/ui/Capsule.tsx:53`), re-armado si cambia el valor; ítem por
  día de `DayDots` con `requestAnimationFrame` (`:53-62`).

---

## 6. Gestos y duraciones cortas de UI

- Pull-to-refresh: `MAX_OFFSET_PX = 80`, `TRIGGER_THRESHOLD_PX = 64`,
  `DRAG_RESISTANCE = 0.5` (`components/layout/usePullToRefresh.ts:4-6`);
  retroceso `duration-200` CSS. Alternativa accesible: botón
  «Actualizar datos» en Alumno (`StudentPage.tsx:132-138`).
- Long-press (edición de horario): `MIN_PRESS_MS = 100`, `DEFAULT_SLOP_PX = 10`
  (`useLongPress.ts:4-5`); default del usuario `DEFAULT_LONG_PRESS_MS = 550`,
  rango dev `200..1500` paso 50.
- Ajustes persistentes de duración: `SETTING_USER_SETTINGS` (`settingsStore.ts:18`).

---

## 7. Persistencia y frescura

| Dato | Escritura | Campo tiempo |
| --- | --- | --- |
| AppData cacheado | `AuthProvider` (`:292-296`) login **y** refresh | `loadedAt` (`new Date().toISOString()`) |
| Último login | `AuthProvider.tsx:159` | `lastLoginAt` (solo login, no refresh) |
| Nudge día | `App.tsx:215` | `lastReAuthPromptDate` (`toDateKey`) |
| Estado del chequeo | `useHorariosCheck.ts` | ISO: `ventanaActiva`, `fechaInicioLabores`, `fechaPublicacionPrehorarios` |
| Tracking de calificaciones | `lib/storage/gradeTracking.ts` | sin timestamps; primer fetch = baseline, luego diffs |
| Records de IndexedDB | `lib/storage/db.ts` | **sin `updatedAt`/`modifiedAt` automático** (`StoreEntry = {key,value}`) |

Pendientes (ROADMAP **§11**, `:316-327`): auto-refresh al abrir/vencer,
estrategia de invalidación de caché, mostrar «última actualización», cooldown
para evitar peticiones repetidas, timeouts de error de red, avisos
offline/stale, reintento al volver la conexión. Hoy la frescura **se guarda
pero no expira nada**.

---

## 8. Fechas de modificación del instituto

- `lib/prehorario.ts:144-156` — `parseFechaModificacion` lee `YYYY-MM-DD HH:MM`
  del listado Apache; los bots de horario/prehorario validan contra `getNow()`
  con `esFechaDentroVentana(fecha, ahora, ventanaDias)` = 7 días (`:352-364`).
- `calendarioLabores.ts` — parser de fechas: inicio de labores (mes < 8 →
  ciclo siguiente, `:79-80`), actividad 5 (día en celda + mes por encabezado de
  columna + año del periodo, **sin** regla +1).

---

## 9. PWA / service worker

- `vite.config.ts:33-63` — `registerType: "autoUpdate"`, sin `periodicallySync`,
  sin reglas `runtimeCaching` por tiempo, sin `reloadPrompt`.
- `src/main.tsx:7` — `registerSW({ immediate: true })`; sin handler de
  actualización. **No hay ejecución del chequeo con la app cerrada** (haría
  falta SW/push del backend — fuera de alcance, ver `docs/api.md`).

---

## 10. Animaciones (duraciones visuales)

`lib/motion/eases.ts`: pill 0.5 s; page exit/enter 0.18/0.5 s; cápsula morph
0.6 s / radius 0.5 s. `AnimatedNumber` 0.9 s. Toast 0.3 s + fade 0.2 s. Cápsula
detail 0.35 s. Punto de hora `studia-breathe 2.6s` (`index.css`). Stagger 60 ms
por hijo (`index.css:341-359`).

---

## 11. Tabla resumen

| Evento | Cadencia / disparador | Reloj | Dónde |
| --- | --- | --- | --- |
| Hora actual del horario | cada **minuto**, + foreground, + cambio de reloj dev | `getNow()` | `useCurrentTime.ts` |
| Chequeo de documentos | **18:00** diario (open / foreground / online / timer) | `getNow()` | `useHorariosCheck.ts` |
| Ventanas del calendario | 15-dic (ENE-JUN), 15-mayo (AGO-DIC) | `getNow()` | `busquedaHorarios.ts` |
| Aviso de turnos de reinscripción | **una vez**, cuando la fecha ya pasó | `getNow()` | `busquedaHorarios.ts` + `App.tsx` |
| Nudge de sesión vieja | 1 vez por día si sesión ≥ **23 h** | real | `App.tsx` |
| Toasts | one-shot por fetch real; **1300 ms** de duración | — | `App.tsx` / `toastVariants.ts` |
| Cápsula: eventos | `class-start`, ≤1 m, ≤1 h — una vez por clase | `getNow()` | `capsuleState.ts` |
| Cápsula: flash / colapso | 2200 / 4200 ms; colapso 1500 ms | — | `ScheduleCapsule.tsx` / `Capsule.tsx` |
| Pull-to-refresh | gesto (umbral 64 px) + botón | — | `usePullToRefresh.ts` |
| Frescura de AppData | `loadedAt` en login/refresh; **no expira** | real | `appDataStore.ts` |
| SW / PWA | autoUpdate en navegación; sin periodic sync | — | `vite.config.ts` |