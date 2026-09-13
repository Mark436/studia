# Notas: calendario oficial + worker de pdf.js

Fecha: 2026-09-06 · Rama: `test/sugerir-horario`

Notas de lo que falló al probar «consultar calendario» y por qué quedó así.
Sirven para recordar el razonamiento sin re-descubrirlo.

> **Actualización 2026-09-10 (decisión del dueño):** la decisión del
> 2026-09-08 se **revierte** y esta §1 vuelve a estar vigente: el calendario
> sale **solo** de la página oficial `calendario-escolar.html` (vía mirror
> `https://api.marcosochoa.dev/ith/`), nunca del listado. El listado ignoraba
> `?C=M;O=D` (orden alfabético), elegía el calendario 2024 y las fechas
> volvían vacías. `elegirCalendario`/`esCalendario` se eliminan;
> `obtenerCalendarioOficial`, `parseCalendarioOficial` e
> `interpretarFuenteCalendario` operan contra la página oficial. El prehorario
> de la carrera sí sigue usando el listado (`elegirPrehorarioCarrera`): ahí no
> hay una página oficial dedicada. Detalle: `docs/sugerir-horario.md` §1 y
> ROADMAP.MD §17.

---

## 1. El calendario sale de la página oficial, no del listado

### Qué estaba mal

La prueba «Probar calendario» (y la selección del calendario en general)
tenía DOS fuentes mezcladas:

| Fuente | Qué hacía |
| --- | --- |
| Página oficial `ith.mx/calendario-escolar.html` | `obtenerCalendarioOficial()` extrae el PDF incrustado (`<embed src>` / `ul.doc a`). |
| Listado público `ith.mx/documentos/?C=M;O=D` | `elegirCalendario()` buscaba archivos llamados `*calendario*.pdf`, ordenados por fecha de modificación, y elegía el más reciente dentro de una ventana de 7 días. |

La decisión de producto es: **el calendario se saca de la página oficial**.
El listado de documentos es una conjetura: depende del nombre del archivo, de
su mtime y de una ventana arbitraria; no refleja lo que el instituto
realmente publicó en la página oficial. Podía elegir un PDF viejo, uno de
otra página, o no elegir nada.

> Revisado 2026-09-08 y **revocado 2026-09-10**: el 2026-09-08 se movió la
> búsqueda del calendario del ciclo siguiente al listado (confinada a las
> vacaciones, cadencia de 7 días, decisión del dueño); en 2026-09-10 el dueño
> pidió revertir: el listado ignoraba `?C=M;O=D` (orden alfabético) y
> `elegirCalendario` elegía el calendario 2024 — las fechas volvían vacías.
> El calendario vuelve a salir **solo** de `calendario-escolar.html`.

### Cómo se detectó

Al probar «Probar calendario» en modo dev, el resultado mezclaba el PDF
oficial con candidatos del listado y el «elegido» salía del listado — no de
la página oficial.

### Qué se cambió

- `src/lib/prehorario.ts`
  - En su momento se eliminaron `elegirCalendario`, `ResultadoCalendario`,
    `CandidatoCalendario` y `esCalendario` (código muerto).
  - **2026-09-08:** `elegirCalendario` y `esCalendario` volvieron para la
    detección por listado; `obtenerCalendarioOficial()`, `parseCalendarioOficial()`
    e `interpretarFuenteCalendario()` se eliminaron.
  - **2026-09-10:** se revierte. `elegirCalendario`/`esCalendario` se eliminan
    definitivamente; `obtenerCalendarioOficial()`, `parseCalendarioOficial()` e
    `interpretarFuenteCalendario()` operan contra
    `https://api.marcosochoa.dev/ith/calendario-escolar.html` (mirror con CORS,
    sin proxy). `interpretarFuenteCalendario` resuelve las rutas relativas
    contra esa página y solo acepta su origin + `.pdf`; `parseCalendarioOficial`
    lee `<embed src>` y `ul.doc a[href]` y elige el de mayor año.
  - El prehorario sigue usando el listado (`elegirPrehorarioCarrera`): ahí no
    hay una página oficial dedicada, el listado es la fuente correcta.
- `src/lib/calendarioLabores.ts`
  - El extractor **tolera el espaciado letra a letra** del PDF («P E R IODO»,
    «F i n de cl as es», «20 26») y `extraerFinDeClases` ahora compara **todas**
    las filas de «fin de clases» (licenciatura vs idiomas), no solo la primera.
- `src/features/devtools/components/PruebaCompletaSection.tsx`
  - El paso 1 del pipeline («Calendario (página oficial)») usa
    `obtenerCalendarioOficial()`, el mismo mecanismo del chequeo diario; el
    listado queda solo para prehorarios (paso 3).
- `src/lib/prehorario.test.ts` — tests de `interpretarFuenteCalendario`
  (restaurados 2026-09-10); se retiran los de `esCalendario`/`elegirCalendario`.
- `ROADMAP.MD` §17 — el calendario vuelve a salir de la página oficial.

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

- Página oficial del calendario: `https://api.marcosochoa.dev/ith/calendario-escolar.html`
  (mirror de `ith.mx/calendario-escolar.html`)
- Listado de documentos: `https://api.marcosochoa.dev/ith/documentos/?C=M;O=D`
  (prehorario de la carrera; el calendario ya NO sale de aquí)
- `src/lib/calendarioLabores.ts` — lectura del PDF, worker e interpretación de
  fechas (labores, actividad 5, fin de clases; tolerante al espaciado por letras).
- `src/lib/prehorario.ts` — `obtenerCalendarioOficial()` /
  `parseCalendarioOficial()` / `interpretarFuenteCalendario()` (página oficial),
  prehorario vía `obtenerPrehorarios()` + `elegirPrehorarioCarrera()`.