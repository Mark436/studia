# Rediseño de la cápsula — fases

Bitácora del rediseño del estado de la cápsula vía `stacked` en
`components/ui/Capsule.tsx`. Cada fase marca lo que se implementa y deja
anotado lo que falta por dictar. Las fases pendientes quedan aquí abajo en
orden para que sigas diciendo qué cambia.

## Fases implementadas

### Fase 0 — Solo morf (quitada la variante pill)

- Se eliminó la variante `pill` y el toggle de Ajustes → Interacción.
- `Capsule` ahora es siempre el morf iOS (píldora → tarjeta 20 px).
- Se removió `capsuleVariant` de `UserSettings` (`features/settings/types.ts`),
  su migración, test y el `SegmentedControl` de `SettingsSheet`. `App.tsx` ya no
  pasa `variant`; `ScheduleCapsule` ya no lo recibe.

### Fase 1 — Blur constante durante el morf

- El posicionamiento dejó de animar `left`/`xPercent` (que obligaba al
  navegador a recomputar el `backdrop-filter` frame a frame).
- El viaje a la posición centrada es ahora una **transform compuesta `x`**
  calculada desde el contenedor; el glass se rasteriza una vez y el blur se
  mantiene idéntico durante toda la animación.

### Fase 2 — Colapso siempre con la misma duración

- Antes, React reseteaba el `left` inline al colapsar y el colapso se veía
  instantáneo. Ahora la posición es del `transform`, propiedad que React no
  toca, así que colapsar reproduce el tween completo (0.6 s) igual que
  expandir, sea cual sea el disparador (tap, pulso, temporizador, Escape,
  blur, toque fuera).

### Fase 3 — Estado "En clase": minimizado y expandido nuevos

Minimizado:
- Línea 1: contador de horas/minutos + **salón a la derecha de los números**
  (crudo, sin prefijo).
- Línea 2: **materia en texto chico resumida** (`shortenSubjectName`, umbral
  12 caracteres) que nunca envuelve.

Expandido (`stacked`):
- Mismo contenido y misma distribución, en la **variante tipográfica grande**
  (`minimizedExpanded`, layout real). Se abandonó el `transform: scale ×1.25`
  porque el contenido desbordaba el contenedor: despegaba el anillo del borde
  y la cápsula se veía chica.
- Debajo de la materia, el **profesor** en jerarquía secundaria
  (`formatProfessorLabel`: solo apellidos si llega "Apellidos, Nombre").
- Ya **no** se muestra "Termina a las".

### Fase 4 — Barra de progreso como borde SVG

- Se reemplazó la máscara CSS del borde-progreso por dos `<path>` de medio
  perímetro con `vector-effect: non-scaling-stroke` y `pathLength`, dentro de
  un `<g>` posicionado `inset-0` relativo a la cápsula (siempre pegado al
  borde).
- Dirección de revelado (decidido por el usuario): ambos arcos arrancan en el
  **medio del borde izquierdo** y se llenan a la vez hacia arriba y abajo;
  el hueco se cierra en el medio del borde derecho.
- El radio del arco coincide con el de la cápsula (`EXPANDED_RADIUS_PX` 20 en
  expandido; `height/2` en píldora) y es **estático por estado** — no se
  tweena (Fase 1), así el trazo tiene la forma píldora/card correcta en
  cualquier pantalla.

### Fase 5 — Tokens de escala y cápsula neutra sin borde

- Los tamaños de la cápsula (tipografía y espaciado) se declaran en una escala
  propia con nombres de rol tipo Material (`@theme` en `index.css`):
  `--text-capsule-*` y `--spacing-capsule-*`, consumidas como utilidades
  Tailwind (`text-capsule-body`, `gap-capsule-gap-lg`, `p-capsule-pad`).
  Documentadas en `docs/design.md` §2.
- Contadores: sub-escala de numerología `--text-capsule-num-*`. La hora baja a
  `font-semibold` (más ligera; la jerarquía la da el tamaño, no el peso).
- Unidades redondeadas a la escala (9 px → 10 px).
- El salón es `font-medium` (no bold): el blanco sobre el glass ya lo hace
  resaltar. **Sin horas de inicio/fin** en ninguna cápsula: la información
  adicional es salón, profesor y materia.
- La cápsula neutra (upcoming / done / empty / flash) usa
  `glass-panel-bare`: mismo glass, sin el anillo de 1 px. Solo «En clase»
  conserva el borde acento (`glass-panel-accent`).

### Fase 6 — Morf sin saltos de altura

- El salto al final del morf venía del `transition-[padding,opacity]`
  declarado en la clase: al medir el destino, la transición recién empezada
  reporta el padding de la posición de salida, el tween queda corto y la caja
  "pega" al final. Ahora el morf desactiva la transición inline (la restaura
  como `""` al terminar, para que la clase siga mandando), mide con el layout
  objetivo y anima `paddingTop/Right/Bottom/Left` con GSAP en sincronía con
  `width`/`height`.
- El pop del flash también desactiva la transición durante su tween: el blink
  de opacidad es por-frame y el `transition-[opacity]` de la clase lo doblaría.
- El flash, al limpiarse (vida útil de 10 s), **vuelve** al tamaño del pill del
  horario con un settle suave (`CAPSULE_COLLAPSE_DURATION/EASE`, sin blink) en
  vez de cambiar de contenido con un salto.

## 5. Estados de la cápsula — inventario (plegado / desplegado)

Fuente de render: `features/schedule/components/ScheduleCapsule.tsx`. Estados
puros: `empty | in-class | upcoming | done` (`features/schedule/capsuleState.ts`),
más el **flash** transitorio de eventos académicos. Todos pasan por la misma
primitiva (`components/ui/Capsule.tsx`): plegado = ancla; desplegado = ancla
escalada (`stacked`) o bloque de detalle a la derecha, según el caso.
Auto-colapso tras `autoCollapseMs` (por defecto 1500 ms); tap/evento alterna
manual. Expansión automática solo en eventos importantes (inicio de clase,
T-60 min, T-1 min) y flashes académicos.

### 5.1 En clase (`in-class`) — tono acento, `stacked`

Aparece mientras `inicio ≤ ahora < fin`. Lleva `progressPercent` (anillo).

**Plegado:**
- Línea 1 — `DurationCounter` con `remainingMinutes` (`DurationCounter`:
  horas `font-semibold` + "h" fina; minutos a mitad de tamaño + "m" más chica;
  todo `primary-strong`, `tabular-nums`; escala propia `--text-capsule-num-*`)
  + **salón crudo** a la derecha en la misma línea (`items-baseline
  gap-capsule-gap`, `text-capsule-body font-medium text-on-surface`).
- Línea 2 — materia resumida (`shortenSubjectName`, umbral 12),
  `text-capsule-caption font-medium text-on-surface-variant`,
  `max-w-capsule-line-sm truncate` (nunca envuelve).

**Desplegado (`stacked`):**
- Ancla en variante tipográfica grande (`minimizedExpanded`, layout real,
  sin `transform: scale`). Línea 1: `DurationCounter` `lg` + **salón**
  (`min-w-0 truncate text-capsule-headline font-medium text-on-surface`).
  Línea 2: **materia completa** (sin resumir),
  `text-capsule-body font-medium text-on-surface`, `truncate` y con revelado
  progresivo (`studia-capsule-in`).
- Bloque revelado bajo la materia: **profesor** (`formatProfessorLabel`: solo
  apellidos si llega "Apellidos, Nombre"), `text-capsule-caption font-medium
  text-on-surface-variant truncate`. Solo aparece desplegado.
- **Sin horas**: ninguna cápsula muestra a qué hora inicia o termina; la
  información adicional es salón, profesor y materia.
- Colores distintos entre materia (`text-on-surface`) y profesor
  (`text-on-surface-variant`).
- `min-w-0` + `truncate` en salón, materia y profesor: el contenido cabe en
  pantallas estrechas (móvil) sin desbordar.
- Plegado: salón `min-w-0 truncate`.
- Anillo de progreso en el borde (SVG — ver Fase 4).
- CAMBIOS HECHOS (todo ajustable): contenido que entra en móvil, materia
  completa y ligera al desplegar con revelado progresivo, horas del contador
  más ligeras, salón en `font-medium` (el blanco ya lo hace resaltar),
  colores materia/profesor distintos, prioridad de apellidos del profesor,
  sin horas de inicio/fin en ninguna cápsula.

### 5.2 Próxima clase (`upcoming`) — tono neutro, `stacked`

Aparece cuando no hay clase en curso y sí una futura hoy.

**Plegado** — mismo formato que "En clase" (colores tal cual los establecidos):
- Línea 1 — `DurationCounter` con `minutesUntil` + **salón**
  (`min-w-0 truncate text-capsule-body font-medium text-on-surface`).
- Línea 2 — materia resumida (`shortenSubjectName`, umbral 12),
  `text-capsule-caption font-medium text-on-surface-variant truncate`.

**Desplegado (`stacked`)** — sigue el diseño de clase en curso:
- Línea 1 — `DurationCounter` `lg` con `minutesUntil` + salón
  (`text-capsule-headline font-medium text-on-surface`). Línea 2 — materia
  completa `text-capsule-body font-medium text-on-surface truncate` con
  revelado progresivo.
- Bloque revelado: **profesor** (`formatProfessorLabel`). Sin horas de inicio.
- CAMBIOS HECHOS (ajustable): migrado a `stacked`; plegado con el formato de
  clase en curso; sin "dura X" ni horas de inicio/fin (solo materia, salón y
  profesor, como en "En clase").

### 5.3 Sin clase por delante (`done` / `empty`) — tono neutro, un solo estado

Los estados `done` y `empty` se fusionan en render: cuando hoy no queda clase
por delante, la cápsula mira la **próxima clase futura** (primero con clase,
desde mañana en adelante; `getNextClassInfo`). Sin clases restantes en la
semana, queda el mensaje calmado y la app sigue funcionando.

**Plegado:**
- Con clase mañana → solo `mañana HH:MM` (`text-capsule-body font-semibold
  tabular-nums text-primary-strong`). Ya no se usa el conteo de horas ("Xh");
  el formato es fijo (la regla de las 22:00/3 h desapareció).
- Con clase en un día posterior → `nos vemos el {día}` (p. ej. "nos vemos el
  lunes"), `text-capsule-body font-semibold text-primary-strong`.
- Sin clases en la semana → `Consulta otro día desde tu horario.`
  (`text-capsule-body font-medium text-on-surface-variant`).
 

**Desplegado:** CAMBIOS HECHOS — ahora es `stacked`, siguiendo la lógica de las
otras cápsulas: el ancla (`minimizedExpanded`) es el contenido del plegado en
variante tipográfica grande, sin repetir `mañana`/día abajo (ya fecha el
plegado; se eliminó la línea de referencia al día que duplicaba el dato).
- Ancla (`minimizedExpanded`): mensaje del plegado grande `font-display
  text-capsule-title font-bold`: `Mañana HH:MM` / `Nos vemos el {día}`.
- Bloque desplegado (`expanded`): materia (`subjectName` completa) y salón
  (`formatClassroomLabel`), `text-capsule-body`, materia en `font-semibold
  text-on-surface`, salón `text-on-surface-variant`, separados por " · ", todo
  `truncate`. **Sin la hora**: ya está en el plegado y en el ancla.
- Sin clases en la semana → solo el mensaje `Consulta otro día desde tu
  horario.` (sin bloque extra al desplegar).
- CAMBIOS HECHOS (ajustable): migrado a `stacked`; ancla grande del mensaje
  del plegado; sin la referencia al día duplicada; materia + salón abajo (sin
  hora, que ya vive en el plegado/ancla); la lógica de "ancla = plegado en
  grande, bloque = solo dato nuevo" se mantiene en todas las cápsulas.

### 5.5 Flash de evento académico — tono neutro, `stacked`

Ruta `notification` (calificaciones nuevas, adeudos, progreso, reinscripción).
Un solo aviso coherente con tres campos complementarios: `title` (qué pasó),
`detail` (el dato concreto que solo se muestra al expandir) y `conclusion` (la
consecuencia/resumen que calza colapsada). **Transitorio**: el aviso se limpia
solo tras `CAPSULE_FLASH_LIFETIME_MS` (10 s) y la cápsula vuelve al horario.
No se abre al llegar: nace **plegado** con un **pop bouncy** (escala y tamaño
`back.out(2)` 0.6 s, `popKey` en `Capsule`) + **parpadeo** (doble blink de
opacidad); el plegado crece hacia su nuevo tamaño (título + conclusión) para
que se entienda que algo cambió, sin abrir la tarjeta. Si el usuario la abre,
se revela el detalle. Canal configurable (cápsula / toast) — mismo evento una
sola vez.

CAMBIOS HECHOS: el flash ya no se abre solo (se quitó el pulso); pop bouncy +
parpadeo al llegar; vida útil de 10 s (`CAPSULE_FLASH_LIFETIME_MS`), luego se
limpia. El detalle solo aparece si el usuario abre la cápsula.

**Plegado** — filas apiladas (título + conclusión; el detalle no aparece):
- Línea 1 — título `text-capsule-body font-semibold text-on-surface`
  (ej. "Nueva calificación").
- Línea 2 — `notification.conclusion`
  (`text-capsule-body font-medium tabular-nums text-primary-strong`, ej.
  "Promedio · 8.75").
  

**Desplegado (`stacked`)** — ancla con el título (`text-capsule-headline`) y
la conclusión; bloque de énfasis bajo la materia con el detalle:
- Eyebrow `notification.title` + `notification.detail` `font-display
  text-capsule-display font-bold leading-tight` + `notification.conclusion`
  (`text-capsule-body tabular-nums text-primary-strong`).
- CAMBIOS HECHOS (ajustable): migrado a `stacked`; título + conclusión
  plegados, detalle al expandir; se eliminó la secuencia en dos fases
  (detalle → seguimiento).

## Pendientes (para seguir dictando) + calibración abierta

1. **Profesor**: validar la heurística de apellidos con datos reales
   (`docente` de la API) — formato exacto a confirmar.
2. **Resumido de materia**: calibrar el umbral de 12 caracteres contra
   nombres reales (hoy es una estimación de anchura General Sans 500
   text-capsule-caption).
3. **Calibración en dispositivo (ajustable, ya implementado)**: timings del
   morf (0.6 s) y tamaños del expandido — ya en tokens (`text-capsule-*`,
   `spacing-capsule-*`), línea "· dura X" (solo upcoming), `gap`, paddings,
   revelado con `studia-capsule-in`. Dirección del anillo (medio-izquierda →
   arriba y abajo) ya implementada en Fase 4; todo lo tocado queda abierto a
   correcciones al verlo en el teléfono.