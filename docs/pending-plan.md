# Plan pendiente (cierre de sesión)

Estado real del árbol de trabajo al cerrar esta sesión. Sirve como punto de
entrada para retomar el trabajo en otra sesión.

## Hecho y pusheado

- **Repliegue de la cápsula** (`src/components/ui/Capsule.tsx`, commit
  `60d3230`):
  - El contenido expandido permanece montado durante todo el repliegue; el
    swap al contenido colapsado ocurre al **terminar** la animación
    (`collapsing` + `frozenWidth` + `flushSync` en `onComplete`), no al
    iniciar.
  - El ancho interno se congela (`frozenWidth`) para que el texto conserve
    sus saltos de línea mientras la caja se encoge; `overflow-hidden` recorta.
  - Radio, padding, ancho y alto se interpolan juntos, simétricos con la
    expansión (`borderRadius: fromRadius → targetRadius`).

## Pendiente

### 1. Temas de color — NO iniciado

La preparación de temas descrita antes **no está en el repo todavía**: no
existe `src/lib/theme/`, ni el campo `theme` en `UserSettings`
(`src/features/settings/types.ts`), ni bloques `[data-theme="..."]` en
`src/index.css`, ni `applyTheme`. Lo único que entró en `5085cc2` fue el
layout de la cápsula (`capsuleExpanded` / `topSpace`), no el color.

Falta (objetivo original):

- Registro de temas (~5): conservar el actual como **default** (`cobalto`),
  más `menta` (verde menta + gris), `petroleo` (azul petróleo profundo) y
  otros 2 inventados.
- Cada tema con variante clara y oscura. Los temas solo deben sobreescribir
  la **identidad** (tokens `--studia-cobalto`, `--studia-cobalto-strong`,
  `--studia-accent-glass-tint`, `--studia-accent-glass-border`); neutros y
  funcionales se comparten.
- Bloque CSS por tema en `src/index.css` con selector `[data-theme="..."]`
  (claro y `@media (prefers-color-scheme: dark)`).
- Aplicar el tema con el atributo `data-theme` en `<html>` (efecto en
  `src/app/App.tsx` o provider dedicado).
- Persistir en `UserSettings`: añadir `theme` (+ default y parsing en
  `src/features/settings/types.ts` y `useSettings.ts`).
- **No** construir aún el selector en Ajustes (el usuario lo pidió después);
  solo dejar la infraestructura lista.
- Sugerencia de limpieza: nombrar los tokens de identidad `--studia-accent*`
  para que el nombre no quede atado a "cobalto" (hoy `Capsule.tsx` usa
  `var(--studia-cobalto)` directo).

### 2. Filtro "Cursando" — nota para el API (no tocar el cliente aquí)

Ya se amplió `ESTADOS_CURSANDO = [1,5,6,7,8,9,11,12,13]` y se centralizó
`ESTADOS_ACREDITADOS = [2,3,4]` en `src/features/reticula/types.ts`.

Cambio recomendado del lado del API / `sith-api-client` (lo hace el dueño en
el otro proyecto, **no** en esta app): exponer/normalizar un estado "en curso"
que cubra todos los tipos de inscripción, en lugar de depender de la lista de
códigos. Con eso el filtro "Cursando" no se rompe cuando aparezca un código
nuevo.

### 3. Verificaciones / notas

- `pnpm lint`: solo warnings preexistentes
  (`src/lib/devtest/provider.tsx`, `src/features/schedule/oferta.ts`).
- `pnpm test --run`: 230/230.
- `pnpm vite build`: OK.
- `pnpm build` (con `tsc -b`) falla por 3 errores **preexistentes** en
  `src/features/schedule/oferta.ts` (`calcularCosto` y `buscarHorario` sin
  usar, `ofertas` sin definir). No forman parte de este trabajo; conviene
  arreglarlos o excluirlos aparte.

## Ya implementado previamente (referencia)

- Recorte de nombres de materia (`src/features/schedule/utils.ts` + tests):
  se eliminan conectores y se abrevian palabras finales a 3 letras
  (`CAPSULE_SUBJECT_FULL_CHARS=12`, `SUBJECT_WORD_ABBREV_CHARS=3`).
- Retícula: semestres no terminados colapsables y abiertos por defecto
  (`ReticulaCard.tsx`, `ReticulaPage.tsx`).
- Cápsula flash: ancho acotado (`min(12rem, calc(100vw - 18rem))`) +
  `overflow-wrap:anywhere`.
