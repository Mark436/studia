# Design System — Studia

Fuente de verdad del sistema visual y de movimiento. Complementa
[`product.md`](product.md) (qué hace la app) y [`architecture.md`](architecture.md)
(cómo se organiza el código). Un cambio visual significativo empieza aquí.

## 1. Concepto

> El lujo del vacío bien administrado, interrumpido por un solo evento de color:
> la cápsula que siempre sabe qué toca ahora.

- Superficies neutras estrictas; jerarquía por tipografía, no por decoración.
- La **Cápsula de Contexto** es el único objeto cromático por pantalla y codifica
  el principio de producto *contexto sobre navegación*.
- Personalidad: herramienta costosa con movimiento vivo. Calma estructural tipo
  Notion; micro-vida tipo Duolingo solo donde el tiempo fluye.
- Sin wordmark en la interfaz diaria. «Studia» vive en login, instalación PWA y
  splash.

## 2. Tokens

Variables CSS semánticas en `src/index.css`, intercambiadas por
`prefers-color-scheme` y expuestas a Tailwind v4 mediante `@theme inline` (las
utilidades leen la variable directamente: sin JS de tema ni clases duplicadas).

| Token | Claro | Oscuro | Rol |
| --- | --- | --- | --- |
| `background` | `#FAFAFB` | `#12141A` | fondo de app |
| `surface` | `#FFFFFF` | `#1A1D24` | tarjetas |
| `on-surface` / tinta | `#17181C` | `#F2F4F8` | texto principal |
| `on-surface-variant` | `#5C6270` | `#9BA3B4` | texto secundario |
| `outline` | `#D9DCE3` | `#333845` | bordes de input |
| `outline-variant` | `#ECEDF1` | `#262A33` | hairlines y anillos |
| **`primary` / cobalto** | **`#2E6BFF`** | **`#6B93FF`** | identidad: cápsula, foco, activo |
| `primary-strong` | `#1B49C8` | `#B4CBFF` | texto/énfasis cobalto legible |
| `primary-container` | `#EAF0FF` | `#1C2B4A` | tintes contenedores |
| `success` | `#1DA55A` | `#3DD68C` | funcional (calificaciones nuevas) |
| `error` | `#E5484D` | `#FF6369` | funcional (adeudos, conflictos) |

Reglas de uso:

- El cobalto es escaso por diseño: cápsula activa, clase en curso, foco visible,
  números héroe. Si todo es azul, nada lo es.
- Éxito/error son funcionales, nunca identidad.
- Modo oscuro = carbón suave (`#12141A`), no negro puro; elevación por capas de
  superficie, no por sombras duras.

### Forma y elevación

- Radios: tarjetas `20px`, botones/badges/toast píldora completa, inputs `12px`.
- Sombra clara: suave y profunda (utilidad `elevated`). Oscura: casi nula, la
  separación la dan superficie y anillo.
- **Liquid glass** (utilidades `glass-panel` / `glass-panel-accent`):
  `backdrop-blur(20px) saturate(1.6)` + tinte semitransparente + brillo
  especular superior + anillo luminoso. Fallback sólido vía `@supports`.
  Reservado a: cápsula, navegación inferior, toast neutro.

## 3. Tipografía

Dos voces, self-hosted en `src/assets/fonts/` (woff2, subset latino, precache
del service worker). Sin tipografía mono: los datos usan `tabular-nums`.

| Voz | Fuente | Uso |
| --- | --- | --- |
| Display | **Schibsted Grotesk** variable 400–900 | Títulos de página, nombre de materia en curso, promedios héroe, cápsula expandida. Bold 700+, `tracking-tight`. |
| UI / cuerpo | **General Sans** 400/500/600/700 | Todo lo demás: listas, etiquetas, formularios, toasts. |

Clases Tailwind: `font-display` / `font-sans` (por defecto en `body`).

## 4. Cápsula de contexto

Primitiva genérica: [`components/ui/Capsule.tsx`](../src/components/ui/Capsule.tsx)
(sin conceptos académicos). Estado y contenido:
`features/schedule/components/ScheduleCapsule.tsx`. Montaje único y persistente
en el shell autenticado (`ContextCapsule` en `app/App.tsx`, vía `topSlot` de
`AppShell` → `TopZoneProvider`): visible en todas las secciones, alimentada por
el estado compartido del horario (`ScheduleStateProvider`). Altura reservada
constante para no mover el layout.

Las páginas no montan su propia cápsula (la variante académica de calificaciones
fue retirada): una sola isla sirve toda la app. Los headers de página
desaparecieron; la barra inferior orienta la sección.

### Estados

| Estado | Tono | Contenido minimizado |
| --- | --- | --- |
| En clase | acento | contador de horas y minutos + salón a la derecha; debajo el nombre corto de la materia |
| Próxima clase | neutro | contador de horas y minutos + salón |

El contador jerarquiza por tamaño (no por color): la hora va grande y bold, la
unidad "h" fino; los minutos a la mitad del tamaño y la "m" más chiquita aún.
El salón se muestra crudo ("LB-24"), sin prefijo, en su misma línea y a la
derecha de los números. La materia debajo usa un nombre resumido que cabe si
el real es largo (`shortenSubjectName`, umbral 12 caracteres) y nunca envuelve.
| Por hoy terminaste / Sin clases hoy | neutro | mensaje calmado (+ "mañana HH:MM" si hay clase) |
| Evento académico | neutro | título del evento + dato clave |

### Expandido de clase (estado "En clase")

El contenido minimizado **es** el contenido expandido: no hay un bloque de
detalle aparte. Al expandir, el ancla (contador + salón + materia) se **escala
×1.25 por transform** con el mismo layout — nunca se cambia el `font-size`, así
la distribución no se re-fluye — y debajo de la materia aparece el profesor
(solo apellidos si el dato llega en formato "Apellidos, Nombre",
`formatProfessorLabel`) en su jerarquía de texto secundario. No se muestra
"Termina a las".

### Expansión automática (solo eventos importantes)

```text
cambio de clase            → "class-start"
cuenta cruza T-60 min      → "one-hour"
cuenta cruza T-1 min       → "one-minute"
```

- La primera observación tras abrir la app nunca dispara eventos (entrar a
  mitad de ventana no grita).
- Cada evento dispara una vez por clase (dedupe por id).
- Nunca se dispara por minutos que simplemente bajan.

### Secuencia de eventos académicos (canal cápsula)

Calificaciones nuevas/cambiadas, adeudos y progreso llegan a la cápsula en dos
fases: detalle (~2.2 s) → seguimiento (~2 s) → colapso. Ejemplo: "Nueva
calificación · Redes · 9.5" y después "Promedio del periodo · 8.75". El canal
es configurable en modo dev → Interacción ("Cápsula" / "Toast"); con toast los
eventos usan el snackbar clásico. Ambos canales disparan una sola vez por
evento real.
- Auto-colapso tras `DEFAULT_CAPSULE_COLLAPSE_MS` (1500 ms); tap alterna manual
  siempre y cancela el temporizador. Blur, toque fuera y Escape también
  colapsan; la apertura manual igualmente programa su colapso.
- Al expandirse se **centra** horizontalmente; el morf viaja con una transform
  compuesta (`x`) calculada desde la posición inicial, nunca con `left`: el
  backdrop-blur del glass se mantiene rasterizado y constante durante todo el
  tween.
- Colapso y expansión usan **la misma duración siempre**, sin importar qué lo
  accione (tap, pulso automático, temporizador, Escape, blur o toque fuera):
  la posición, al ser propiedad del transform, nunca la resetea React a mitad
  de camino.
- El **ancla** (contador + salón + materia) se mantiene montado y no cambia de
  contenido; al expandir se escala con un transform desde `top-left`.
- La barra de progreso de la clase es un **borde SVG** (rect con
  `vector-effect: non-scaling-stroke` + `pathLength`), posicionado `inset-0`
  relativo a la cápsula para que siempre acompañe el borde; el radio del rect
  anima en sincronía con el `border-radius` de la cápsula.

### Forma

**Morf iOS**: círculo minimizado → tarjeta redondeada 20 px al expandir.
Es la única variante; no hay toggle de forma.

### Radio animable

El radio nunca usa `9999px`: se calcula como la mitad de la altura medida
(`border-radius: calc(h/2)`), así la interpolación ocurre entre valores px
concretos y el morfo es limpio frame a frame.

## 5. Movimiento

Motor: **GSAP** (`gsap` + `@gsap/react`) para morfos y contadores;
transiciones CSS para micro-feedback. Sin librerías adicionales.

| Momento | Tratamiento |
| --- | --- |
| Morfo de cápsula | GSAP tween geométrico `power3.out` 0.6 s (transform `x` compuesta + radio; el ancla se escala por `transform` sin reemplazarse) |
| Desliz del indicador activo (barra inferior) | GSAP `translateX` `back.out(1.6)` 0.5 s; posiciona sin tween con `prefers-reduced-motion` |
| Transición de contenido entre tabs | Salida `power2.in` 0.18 s (fade + subida), entrada `back.out(1.5)` 0.5 s (rise + rebote); líquida sobre un solo contenedor persistente |
| Números héroe | contador GSAP `power3.out` 0.9 s (`AnimatedNumber`) |
| Toque (botones, cápsula) | `active:scale-[0.97]` CSS 150 ms |
| Hora actual / clase en curso | punto que respira (`studia-breathe` 2.6 s, `motion-safe`) |
| Entrada de contenido de cápsula | `studia-capsule-in` 0.35 s (fade + subida suave; el anchor no se refluye) |
| Entrada de toast | `studia-fade-up` 0.3 s |
| Pull-to-refresh | indicador spinner existente, opacidad ligada al gesto |

Los eases y duraciones del sistema de rebote viven en `src/lib/motion/eases.ts`
(fuente única: barra inferior, transición de contenido y cápsula).

`prefers-reduced-motion`: los springs/morfos se vuelven fundidos o salto
directo (la regla global en `index.css` + guardas explícitas en Capsule y
AnimatedNumber).

## 6. Accesibilidad

- La cápsula es un `<button>` real: foco con teclado, Enter/Espacio alternan,
  `aria-expanded` y `aria-label` descriptivo del estado.
- Los gestos nunca son el único camino (pull-to-refresh tiene botón en Alumno).
- Contraste: `primary-strong` existe para texto cobalto pequeño sobre claro.
- `focus-visible` global en cobalto; sin outline en click táctil.

## 7. Inventario de primitivas

`Button` (píldora), `Card` (20 px + elevated), `Badge` (+`className`),
`ProgressBar`, `Input`, `Spinner`, `Slider`, `TimeInput`, `Toast` (glass/píldora),
`Capsule`, `AnimatedNumber`, iconos propios en `icons.tsx`.

## 8. Branding

- Manifest: nombre «Studia», `theme_color` cobalto, `background_color`
  `#FAFAFB`; `index.html` declara `theme-color` por esquema (claro/oscuro).
- Iconos actuales en `public/`; rediseño pendiente hacia el lenguaje cobalto.
