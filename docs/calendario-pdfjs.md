# Notas: calendario oficial + worker de pdf.js

Fecha: 2026-09-06 · Rama: `test/sugerir-horario`

Notas de lo que falló al probar «consultar calendario» y por qué quedó así.
Sirven para recordar el razonamiento sin re-descubrirlo.

> **Actualización 2026-09-08 (decisión del dueño):** la §1 quedó **superada**.
> La búsqueda del calendario del **ciclo siguiente vuelve al listado**
> (`elegirCalendario`, primer `*calendario*` en `documentos/?C=M;O=D` sin
> ventana de días), pero limitada a la **ventana vacacional** (fin de clases →
> inicio de labores), con cadencia de 7 días y aplicación **silenciosa**. La
> página oficial se conserva solo como fuente del harness de devtools. Detalle
> del ciclo completo: `docs/sugerir-horario.md` §1/§4.

---

## 1. El calendario salía del listado de documentos, no de la página oficial

### Qué estaba mal

La prueba «Probar calendario» (y la selección del calendario en general)
tenía DOS fuentes mezcladas:

| Fuente | Qué hacía |
| --- | --- |
| Página oficial `ith.mx/calendario-escolar.html` | `obtenerCalendarioOficial()` extrae el PDF incrustado (`<embed src>` / `ul.doc a`). |
| Listado público `ith.mx/documentos/?C=M;O=D` | `elegirCalendario()` buscaba archivos llamados `*calendario*.pdf`, ordenados por fecha de modificación, y elegía el más reciente dentro de una ventana de 7 días. |

La decisión de producto de ese momento fue: **el calendario se saca de la
página oficial**. El listado de documentos es una conjetura: depende del
nombre del archivo, de su mtime y de una ventana arbitraria; no refleja lo que
el instituto realmente publicó en la página oficial. Podía elegir un PDF viejo,
uno de otra página, o no elegir nada.

> Revisado 2026-09-08: con la búsqueda confinada a las **vacaciones** (no a
> ventanas arbitrarias sobre el mtime), la conjetura del listado vuelve a ser
> aceptable y es la única fuente viable para detectar el calendario del ciclo
> siguiente (la página oficial acabó siendo inaccesible en producción; ver
> `ROADMAP.MD` §17 transporte). La ventana de 7 días sobre el archivo ya **no**
> existe: la cadencia la controla el chequeo (cada 7 días, decisión del dueño).

### Cómo se detectó

Al probar «Probar calendario» en modo dev, el resultado mezclaba el PDF
oficial con candidatos del listado y el «elegido» salía del listado — no de
la página oficial.

### Qué se cambió

- `src/lib/prehorario.ts`
  - En su momento se eliminaron `elegirCalendario`, `ResultadoCalendario`,
    `CandidatoCalendario` y `esCalendario` (código muerto).
  - **2026-09-08:** `elegirCalendario` y `esCalendario` vuelven
    (`lib/prehorario.ts`), para la detección del calendario del ciclo siguiente
    por listado durante las vacaciones.
  - `obtenerCalendarioOficial()` / `parseCalendarioOficial()` se conservan como
    fuente alternativa del harness de devtools, no para la detección.
  - El prehorario sigue usando el listado (`elegirPrehorarioCarrera`): ahí no
    hay una página oficial dedicada, el listado es la fuente correcta.
- `src/features/devtools/components/PrehorarioTestSection.tsx`
  - «Probar calendario» consulta la página oficial y lee las fechas de «inicio
    de labores» del PDF.
- `src/lib/prehorario.test.ts` — test de `esCalendario` / `elegirCalendario`
  (re-incorporados 2026-09-08).
- `ROADMAP.MD` §17 — la detección del calendario vuelve al listado (vacaciones).

---

## 2. El worker de pdf.js fallaba en dev (error de módulo)

### El error

Después del primer arreglo, al probar «Probar calendario» aparecía:

```
[calendario] error al leer el PDF: Setting up fake worker failed:
"Failed to fetch dynamically imported module:
http://localhost:5173/node_modules/.pnpm/pdfjs-dist@6.3.289/node_modules/
pdfjs-dist/build/pdf.worker.min.mjs?import"
```

### Por qué no funcionaba

En pdf.js v6 (`pdf.mjs`) el worker se crea así:

```js
const worker = new Worker(workerSrc, { type: "module" });   // worker de módulo (ESM)
```

Si crear el Worker falla, pdf.js cae a un «fake worker» que hace:

```js
const worker = await import(workerSrc);   // import dinámico de esa misma URL
return worker.WorkerMessageHandler;
```

El código anterior apuntaba al worker con un import de **asset estático**:

```ts
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;
```

Con pnpm, `?url` devuelve la ruta **cruda** dentro de node_modules:
`/node_modules/.pnpm/pdfjs-dist@6.3.289/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`.
Esa ruta no la sirve Vite dev como módulo cargable:

1. `new Worker(url, { type: "module" })` no logra cargar el archivo → pdf.js
   intenta el fake worker.
2. El fake worker hace `import(workerSrc)` (nota el `?import` añadido por el
   servidor de dev) y ese fetch también falla → exactamente el error de arriba.

En resumen: `?url` devuelve un URL, pero no es un asset que Vite gestione
como módulo ES; con la ruta real de `.pnpm` el servidor de desarrollo no lo
entrega de forma fiable como worker.

### Por qué ahora sí funciona

El arreglo deja que **Vite empaquete el worker** en vez de apuntar a un
archivo suelto:

- `vite.config.ts`:

  ```ts
  worker: {
    format: "es",
  },
  ```

  Fuerza a que los workers se emitan como **módulos ES**, que es lo que
  pdf.js espera (`new Worker(src, { type: "module" })`). Sin esto, Vite
  emitiría un worker IIFE normal (script clásico) y pdf.js fallaría igual.

- `src/lib/calendarioLabores.ts`:

  ```ts
  import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";
  ```

  `?worker&url` le dice a Vite «esto es un worker»: lo procesa por su
  pipeline de workers, genera su propio chunk y devuelve un URL válido tanto
  en **dev** como en **producción**.

### Prueba de que quedó bien

El build ahora emite el worker como asset propio:

```
dist/assets/pdf.worker.min-JnPf75PV.js   1,174.06 kB   ← worker ESM
```

Y `pnpm lint`, `pnpm test` (136) y `pnpm build` pasan. En dev, reiniciar
`pnpm dev` (cambió `vite.config.ts`) y «Probar calendario» ya lee las fechas
del PDF.

---

## Referencias

- Página oficial del calendario: https://ith.mx/calendario-escolar.html
- Listado de documentos: https://ith.mx/documentos/?C=M;O=D (calendario del
  ciclo siguiente y prehorario de la carrera)
- `src/lib/calendarioLabores.ts` — lectura del PDF, worker e interpretación de
  fechas (labores, actividad 5, fin de clases).
- `src/lib/prehorario.ts` — `elegirCalendario()` (detección por listado) y
  `obtenerCalendarioOficial()` (harness devtools); prehorario vía
  `obtenerPrehorarios()`.