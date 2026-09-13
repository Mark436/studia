# Sugerir horario + búsquedas diarias — eventos, disparadores y cadencia

> Rama: `test/sugerir-horario`. Este documento centraliza **todo evento que
> debe ocurrir en un momento concreto o de forma periódica** dentro de esta
> rama (junto con los recurrentes de la app que ayudan a revisar el contexto).
> Catálogo **completo de la app** (tiempo y eventos): `docs/tiempo-eventos.md`.
> Detalle técnico de fondo: `docs/calendario-pdfjs.md`. Checklist global:
> `ROADMAP.MD` §16. No es la fuente de verdad del producto (eso es
> `docs/product.md`); sirve para revisar cuándo/cómo se activa cada cosa.

---

## 1. El ciclo anual de búsqueda (chequeo diario)

El objetivo es **detectar** (no generar) dos publicaciones del instituto,
ancladas a las **18:00** (fin de jornada; se asume que ya subieron los
documentos):

| Publicación | Fuente |
| --- | --- |
| Calendario del ciclo siguiente | página oficial `calendario-escolar.html` vía mirror `https://api.marcosochoa.dev/ith/` — calendario vigente embebido (`obtenerCalendarioOficial()`) |
| Prehorario de la carrera | listado público (`obtenerPrehorarios()` + `elegirPrehorarioCarrera()`) |

El calendario se busca **dentro de las vacaciones de fin de clases**: desde el
**último día de clases del periodo en curso** (`fechaFinDeClases`, p. ej.
11-dic-2026) hasta el **inicio de labores del ciclo siguiente**
(`fechaInicioLabores`, p. ej. 6-ene-2027). Dentro de esa ventana el chequeo
corre **a las 18:00** a lo sumo **cada 7 días** y consulta la página oficial
(`obtenerCalendarioOficial()`); al detectar un calendario nuevo lo aplica
**silenciosamente** (sin toast) y guarda el estado para no reprocesarlo. No hay
ventanas anuales ni límite de antigüedad sobre el archivo.

### Máquina de fases (`src/lib/busquedaHorarios.ts`, lógica pura)

| Fase | Cuándo toca | Qué hace | Estado |
| --- | --- | --- | --- |
| `procesar-calendario` | hay calendario visto sin procesar (o coincide con la página oficial) | lee el PDF; guarda inicio de labores, **fin de clases** y fecha de publicación de prehorarios (actividad 5) | ✅ |
| `buscar-calendario` | dentro de la ventana vacacional | consulta la página oficial (mínimo 7 días entre consultas); calendario nuevo → `calendarioVisto` **silencioso** | ✅ |
| `esperar-prehorario` | fuera de vacaciones, con fecha en mano | espera a la fecha de la actividad 5 (fallback: labores + `diasTrasLabores`) | ✅ |
| `buscar-prehorario` | fecha cumplida | consulta listado; prehorario de la carrera nuevo → aviso | ✅ |
| `completado` | prehorario visto | no hace nada más en este ciclo | ✅ |
| `sin-datos` | sin calendario procesado | no busca; los datos se completan on-demand (`obtenerDatosCalendario()`) | ✅ |

### Umbrales y fechas (están en `busquedaHorarios.ts`)

| Constante | Valor | Significado |
| --- | --- | --- |
| `CONFIG_CHEQUEO_HORARIOS.diasEntreBusquedasCalendario` | **7 días** | cadencia mínima entre consultas de la página oficial dentro de la ventana vacacional |
| `CONFIG_CHEQUEO_HORARIOS.diasTrasLabores` | **1 día** | espera tras inicio de labores solo si falta la actividad 5 |
| `CONFIG_CHEQUEO_HORARIOS.horaChequeo` (`HORA_CHEQUEO`) | **18 (18:00)** | momento del bucle diario (si la app está abierta) |
| Ventana vacacional | `[fechaFinDeClases, fechaInicioLabores)` | delimita la búsqueda del calendario del ciclo siguiente |
| — | sin gate de 24 h | **no se contabiliza** si «ya se chequeó»: el bucle evalúa/filtra cada vez que corre a las 18:00 |

---

## 2. El disparador diario en producción

**El problema que resuelve:** la máquina de fases es lógica pura; en producción
algo tiene que **invocarla** a las 18:00 y mantener el bucle diario.

**Solución actual (implementada, sin commitear):** `useHorariosCheck`
(`src/lib/useHorariosCheck.ts`) + `ejecutarChequeoHorarios()` se dispara:

- al **abrir la app** (montaje del shell autenticado);
- cada vez que la app **vuelve al primer plano** (`visibilitychange`,
  `pageshow`, `focus`);
- al **recuperar la conexión** (`online`);
- con un **timer que re-agenda el próximo 18:00** (`proximoMomentoChequeo`),
  de modo que el bucle sigue vivo mientras la app está abierta.

El disparo solo procede si **ya son las 18:00 o después** (`esHoraChequeo`);
antes de esa hora no se toca el API. **Guard offline:** sin conexión no se
busca ni se persiste nada; el listener `online` re-dispara al recuperar la red.
Es un disparador **reactivo + timer**, no un proceso de fondo.

Cada vez que corre:

- si faltan las fechas del calendario (instalación nueva / estado migrado sin
  fin de clases), las obtiene on-demand con `obtenerDatosCalendario()`;
- decide la fase con `decidirFase(estado, ahora, CONFIG_CHEQUEO_HORARIOS)`;
- si la fecha de la actividad 5 es hoy o ya pasó y no se ha avisado, emite el
  toast de **turnos de reinscripción** (`TURNOS_REINSCRIPCION_TOAST`) y guarda
  `avisoTurnosEnviado`;
- si la fase tiene acción (`tocaAccion`), ejecuta el fetch correspondiente. La
  detección del calendario es **silenciosa** (sin toast); el único toast del
  chequeo es el prehorario de la carrera (`PREHORARIO_DISPONIBLE_TOAST`) y va
  desde `App.tsx`.

**Qué NO existe todavía:**

- No se ejecuta con la aplicación cerrada (requeriría service worker / push
  real del backend → fuera de alcance, ver `docs/api.md`).

---

## 3. Cadencia de reconsulta tras el inicio de labores

Definición: **cada cuánto re-preguntar por el prehorario si aún no aparece**
después de que debería estar publicado.

- **Decisión tomada (dueño, 2026-09-07): 1 vez por día a las 18:00.** No hay
  gate de horas: el bucle diario re-evalúa la fase `buscar-prehorario` en cada
  corrida. Costo mínimo (un fetch ligero al listado) y reacciona rápido si el
  instituto publica tarde.
- El disparo **ya no depende de «inicio de labores + N»**: usa la **fecha de la
  actividad 5** del calendario oficial (orden de reinscripción + Prehorarios).
  El fallback `labores + diasTrasLabores` solo aplica si el PDF no trae la
  actividad.

---

## 4. Calendario del ciclo siguiente (búsqueda por página oficial en vacaciones)

- **No existen ventanas anuales** (15-dic / 15-mayo fueron descartadas). La
  búsqueda del calendario del ciclo siguiente corre **desde el fin de clases**
  del periodo en curso hasta el **inicio de labores** del siguiente — decisión
  del dueño, 2026-09-08.
- **El calendario sale de la página oficial** `calendario-escolar.html`
  (`obtenerCalendarioOficial()`, vía mirror): se toma el PDF vigente que el
  webmaster dejó embebido (`parseCalendarioOficial` elige el de mayor año), con
  una consulta a lo sumo cada **7 días**. **No se usa el listado para el
  calendario** (revocado 2026-09-10: el listado ignoraba `?C=M;O=D`, elegía el
  calendario 2024 y las fechas volvían vacías). Al detectar uno distinto al ya
  procesado se aplica y el ciclo de prehorario se reinaugura.
- Si el estado no tiene las fechas (instalación nueva o usuarias/os migrados del
  esquema de ventanas), se completan **on-demand** (`obtenerDatosCalendario()`).

---

## 5. Tabla resumen de eventos de esta rama

| Evento | Cada cuánto | Quién lo dispara | Dónde está | Estado |
| --- | --- | --- | --- | --- |
| Chequeo calendario/prehorario | 1 vez por día a las 18:00 (si app abierta) | open + foreground + `online` + timer 18:00 | `useHorariosCheck.ts` / `busquedaHorarios.ts` | ✅ |
| Búsqueda de calendario | durante las vacaciones, a lo sumo cada 7 días | fase `buscar-calendario` (+ gate `pasoTiempoBusquedaCalendario`) | `busquedaHorarios.ts:decidirFase` | ✅ |
| Procesar PDF del calendario | al detectar calendario nuevo | fase `procesar-calendario` | `calendarioLabores.ts` | ✅ |
| Búsqueda de prehorario | diaria desde la fecha de la actividad 5 | fase `buscar-prehorario` | `busquedaHorarios.ts` | ✅ |
| Datos del calendario on-demand | cuando faltan fechas (instalación/migración) | `obtenerDatosCalendario()` | `datosCalendario.ts` | ✅ |
| Aviso de turnos de reinscripción | una sola vez, cuando la fecha ya pasó | `ejecutarChequeoHorarios` + nudge | `useHorariosCheck.ts` + `App.tsx` | ✅ |

---

## 6. Otros eventos recurrentes de la app (contexto para revisar)

| Evento | Cada cuánto | Dónde está |
| --- | --- | --- |
| Nudge "datos pueden estar desactualizados" | 1 vez por día, sesión ≥ 23 h | `App.tsx` (`STALE_SESSION_NUDGE_MS`) |
| Actualización automática al abrir / login / datos vencidos | al arrancar (plan, no implementado) | `ROADMAP.MD` §11 |
| Pull-to-refresh | manual (gesto + botón en Alumno) | `components/layout/usePullToRefresh.ts`, `App.tsx` |
| Indicador de hora actual del horario | por minuto exacto (pausa en background) | `features/schedule/` + `lib/devtools/clock` |
| Toasts de calificación / adeudo / progreso | una vez por fetch real que detecta el cambio | `App.tsx` |
| Recordatorio diario de reingreso (fase D) | 1 vez por día | `App.tsx` (`SETTING_LAST_REAUTH_PROMPT_DATE`) |

---

## 7. Generar sugerencias de horario

Objetivo (ROADMAP §16): combinar las **materias pendientes que tocan ya**
(`getMateriasDisponibles` en `src/features/student/reticulaPendiente.ts`) con
los **grupos del prehorario** (`PrehorarioJson` en `src/lib/prehorarioTablas.ts`)
para proponer un horario.

Criterios acordados (decisión dueño, 2026-09-07):

- [x] **Conjunto de materias** = únicamente las que la **seriación** libera
      (`getMateriasDisponibles`), sin cortar por semestre: sirve igual para
      materias muy adelantadas y muy atrasadas.
- [x] **Algoritmo v1** — `src/lib/sugerirHorario.ts` (lógica pura + tests):
      1. Restricción dura: **sin choques** (por día y bloque hora-minuto).
      2. Objetivo primario: **maximizar materias cubiertas**.
      3. Objetivo secundario: **minimizar huecos** entre clases.
      Las materias que no entran se reportan con razón:
      `sin-grupos-en-prehorario` / `no-cabe-sin-choque`. Resultado
      determinista: el desempate usa el orden de entrada.
- [ ] **Criterios futuros** (extienden el puntaje, no la restricción): evitar
      a cierto maestro, evitar huecos de cierto tamaño, priorizar una hora
      hueca / ciertas horas. La función de puntaje ya está aislada como punto
      de extensión.
- [ ] **Dónde se consume**: harness de modo dev para validar contra el PDF real
      primero, o directamente UI en el área Alumno → por decidir.

---

## 8. Mapeo: fechas de disparo ↔ calendario oficial

Muestra local de referencia: `docs/sample-calendario.json` (actividades con
`mes` / `no` / `actividad` / `fecha` consultables). Corresponde al
**PERIODO ENERO-JULIO 2026** (`CALENDARIO_ESCOLAR_2026-1 V2-2.pdf`), extraído
desde la página oficial `ith.mx/calendario-escolar.html`. Conserva las
**anomalías del PDF** en su campo `anomalias` (actividad 6 antes que 5, sin
actividad 36, doble encabezado de la fila 70), por lo que sirve para validar
el parser contra el documento real sin descargar el PDF.

Relación entre las fechas que fijamos para la búsqueda diaria y lo que el
calendario reporta:

| Fecha/regla de disparo | Para qué la usamos | ¿Aparece en la muestra 2026-1? | En qué actividad |
| --- | --- | --- | --- |
| **Fin de clases** del periodo en curso | Inicio de la **ventana vacacional** que dispara la búsqueda del calendario del ciclo siguiente | Sí (ciclo ene-jul) | Act. 58/59 «Fin de clases» — **29 may** |
| **Inicio de labores** del ciclo siguiente | Fin de la ventana vacacional (se deja de buscar) | Sí | Act. 1 «Inicio de labores» — **7 ene**; act. 70 — **3 ago** (ciclo siguiente) |
| **Fecha de la actividad 5** | Disparo de la búsqueda del **prehorario** y del aviso de **turnos de reinscripción** | Sí | Act. 5 «Publicación de orden de reinscripción, referencia bancaria y **Prehorarios**» — **9 ene** |
| Fallback: inicio de labores + 1 día | Solo si el PDF no trae la actividad 5 (`diasTrasLabores`) | Sí | Act. 1 «Inicio de labores» — **7 ene**; act. 70 — **3 ago** (ciclo siguiente) |

Fechas reales de **publicación** del calendario (verificadas por la metadata
del PDF — `CreationDate` — y el orden del listado
`ith.mx/documentos/?C=M;O=D`):

| Archivo | Detección en el listado |
| --- | --- |
| `CALENDARIO_ESCOLAR_2026-2 V1.pdf` | 29-may-2026 (mismo día del fin de clases) |
| `CALENDARIO_ESCOLAR_2026-2 V2.pdf` | 12-ago-2026 |
| `CALENDARIO_ESCOLAR_2026-1 V1.pdf` | **26-ene-2026** (¡después del inicio de labores 7-ene!) |
| `CALENDARIO_ESCOLAR_2026-1 V2.pdf` | 04-feb-2026 |
| `CALENDARIO_ESCOLAR_2026-1 V2-2.pdf` | 22-abr-2026 (metadata 22-abr 10:34, listado 10:48) |
| `CALENDARIO_ESCOLAR_2024-1.pdf` | 18-dic-2023 |
| `CALENDARIO_ESCOLAR_2023-1 V1.pdf` | 10-ene-2023 |

Observaciones útiles para revisar el chequeo diario:

- **El calendario no anuncia su propia publicación**: el webmaster reemplaza el
  PDF embebido en la página oficial cuando publica el del siguiente ciclo, y la
  página **no** refleja el orden del listado (`?C=M;O=D`). Por eso el chequeo
  consulta **la página oficial** (`obtenerCalendarioOficial()`), cuya página
  apunta al PDF vigente, dentro de la ventana vacacional — **no el listado**
  (que en 2026-09 ignoraba la ordenación y entregaba el calendario de 2024).
  El patrón «el calendario se elabora ~3 meses antes» era incorrecto: 2026-1
  salió **26-ene-2026, ya iniciadas las labores**, y 2026-2 salió
  **29-may-2026** (día del fin de clases). No hay patrón estable — la cadencia
  la pone el chequeo (7 días).
- El **prehorario** salió el **9 de enero** = inicio de labores (7 ene) + 2. El
  disparo actual usa la **fecha de la actividad 5** (9 ene), no adivinar con
  labores + N. Esa misma fecha dispara el aviso de **turnos de reinscripción**
  (act. 7 «Reinscripciones licenciatura» — **14 al 16 ene**).
- **Fin de clases** (act. 58/59 — **29 may** en la muestra; **11-dic-2026** en el
  calendario AGO-DIC 2026) delimita la **ventana vacacional** que busca el
  calendario del ciclo siguiente. La regla +1 año de «inicio de labores» **no**
  se aplica al fin de clases: pertenece al propio periodo.
- Anomalías del PDF que el parser debe tolerar (todas cubiertas): la actividad 6
  se imprime antes que la 5; no existe la actividad 36; la fila 70 trae doble
  encabezado «AGOSTO | MAYO» y es la que reporta el inicio de labores del ciclo
  siguiente; el mes de la actividad 5 se infiere del **encabezado de columna**
  más cercano hacia atrás y los acentos se leen corruptos en la extracción
  («Publicaci├│n…») — el parser busca por «orden de reinscripci».