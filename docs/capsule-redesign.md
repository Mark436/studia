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
- Mismo contenido y misma distribución, **escalado ×1.25 por `transform`**
  (nunca se cambia `font-size`), origen `top-left`.
- Debajo de la materia, el **profesor** en jerarquía secundaria
  (`formatProfessorLabel`: solo apellidos si llega "Apellidos, Nombre").
- Ya **no** se muestra "Termina a las".

### Fase 4 — Barra de progreso como borde SVG

- Se reemplazó la máscara CSS del borde-progreso por un `<rect>` SVG con
  `vector-effect: non-scaling-stroke` y `pathLength`, posicionado `inset-0`
  relativo a la cápsula (siempre pegado al borde).
- El radio del rect anima en sincronía con el `border-radius` de la cápsula.
- Dirección de revelado: desde la esquina superior-izquierda en sentido
  horario.

## Fases pendientes (para seguir dictando)

1. **Estado "Próxima clase"**: ¿aplicar el mismo layout minimizado (salón junto
   a los números + materia abajo) y el mismo expandido escalado con profesor?
   Hoy conserva el diseño anterior (detalle a la derecha: "Luego · Salón ·
   HH:MM · en Ym").
2. **Estados "Por hoy terminaste" / "Sin clases hoy"**: conservar tal cual o
   revisar el mensaje/mañana.
3. **Evento académico (flash)**: las 2 fases (detalle → seguimiento) — ¿deben
   usar también el layout `stacked` escalado o mantener el bloque derecho?
4. **Profesor**: validar la heurística de apellidos con datos reales
   (`docente` de la API) — formato exacto a confirmar.
5. **Resumido de materia**: calibrar el umbral de 12 caracteres contra
   nombres reales (hoy es una estimación de anchura General Sans 500 text-xs).
6. **Factor de escala ×1.25 y duración 0.6 s**: afinarlos viéndolos en
   dispositivo.
7. **Dirección del anillo de progreso**: confirmar si la revelación horaria
   (desde arriba-izquierda) es la deseada o debe ser de izquierda a derecha
   como la máscara anterior.