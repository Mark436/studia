# Sith API Client — Notes and Gaps

Reference notes for [`sith-api-client`](https://github.com/Mark436/sith-api-client)
(v2.3.0), the runtime dependency that talks to the academic API (SITH,
Instituto Tecnológico de Hermosillo). The client owns HTTP, parsing, and DTO
mapping; this PWA owns when to fetch, how to cache, and how to present data.

> ⚠️ Unofficial API. Usage restrictions, blocks, or changes are possible; see
> the package README for the full disclaimer.

## Public surface

```ts
import { SithClient } from "sith-api-client";

const client = new SithClient({
  // Optional. Base for the derived `${baseUrl}/login` and `${baseUrl}/logout`
  // endpoints. Defaults to the official http://sith.ith.mx/XTodo/wr.
  baseUrl: import.meta.env.VITE_API_URL,
});

const datos = await client.fetchDatos({ user, pass });
// datos: DatosAlumno = { alumno: Alumno, avisos: Aviso[] }

await SithClient.mapDatos(rawApiTodo); // map a captured raw payload, no HTTP
```

- Keep `.js` extensions on package import paths; it ships as ES modules.
- v2.3.0 exports the shared types from the root entry (`Alumno`, `Aviso`,
  `Credenciales`, `DatosAlumno`, `HorarioDia`, `HorarioMateria`, `Boleta`,
  `Creditos`, `Adeudos`, `CalificacionMateria`, `TIPO_AVISO`) — reuse them
  instead of duplicating DTO shapes.

## Endpoint configuration and the Netlify proxy

The upstream service is plain HTTP only, so browsers hit mixed-content blocks
when the PWA is served over HTTPS (and CORS is not guaranteed either).
`SithClient({ baseUrl })` plus a server-side proxy solve both:

```text
Browser (HTTPS)
  └─POST https://<site>.netlify.app/api/sith/login   ← same-origin in production
      └─ netlify/functions/sith-proxy.mts             ← transparent passthrough
          └─POST http://sith.ith.mx/XTodo/wr/login    ← plaintext hop (unavoidable)
```

- The proxy forwards POST bodies verbatim for `login`/`logout` only, returns
  the upstream status/body untouched, and never logs or stores credentials.
- `VITE_API_URL=https://<site>.netlify.app/api/sith` in production; unset ⇒
  direct official endpoint (fine for trusted/local contexts only).
- Local development: either point `VITE_API_URL` at the deployed function
  (its CORS answers any origin by default) or run `netlify dev` for a fully
  local same-origin setup at `http://localhost:8888/api/sith`.
- Dev server proxy (Codespaces / plain `pnpm dev`): `vite.config.ts` mounts
  `/api/sith` → `http://sith.ith.mx/XTodo/wr` via `server.proxy`. With
  `VITE_API_URL=/api/sith` the browser hits the same origin (the forwarded
  Codespaces URL) and Vite proxies server-side, so neither CORS nor mixed
  content applies. This proxy is dev-only; production keeps using the Netlify
  function on the same relative path.
- Proxy environment variables: `SITH_UPSTREAM_URL` (override upstream base)
  and `CORS_ALLOW_ORIGIN` (lock CORS to the site origin once deployed).

## Request lifecycle (stateless)

Every `fetchDatos()` call performs a complete one-shot cycle:

1. Validate `{ user, pass }` locally (throws `SithAuthError` when blank).
2. `POST ${baseUrl}/login` with JSON `{ user, pass }`.
3. Parse the response and require `al` (alumno payload) plus `tkn` (session
   token); otherwise throw `SithAuthError` with the API's error avisos as
   `cause`.
4. Best-effort `POST ${baseUrl}/logout` with `{ tkn }`. Since v2.3.0 a failed
   logout **no longer discards the downloaded data** — a warning aviso is
   appended to the result instead.
5. Map the payload to DTOs and return `{ alumno, avisos }`.

Consequence: **there is no session.** The token is consumed internally and
never exposed; every data refresh needs the credentials again.

## Errors

v2.3.0 ships a typed hierarchy under `SithError`; our `lib/api` layer maps it
to UI-facing kinds:

| Package error       | Meaning                                            | App kind              |
| ------------------- | -------------------------------------------------- | --------------------- |
| `SithAuthError`     | Blank credentials locally, 401/403, or API-rejected | `invalid-credentials` |
| `SithNetworkError`  | fetch rejection (network/DNS/CORS)                  | `connection`          |
| `SithHttpError`     | Other HTTP !ok or non-JSON body (exposes `.status`) | `connection`          |

The original `cause` shape is preserved on every error for debugging. Error
messages are Spanish and generic — never surface them raw.

## Data model (as returned)

Reuse the package's types instead of duplicating them. Summary of the mapped
graph returned by `fetchDatos()`:

**`Alumno`**

- Identity: `numeroControl`, `nombre`, `carrera`, `correo`, `telefono`,
  `semestre`, `fechaReinscripcion`
- Academics: `promedioGeneral` (`number`), `promedioSemestral` (`number`),
  `boleta { periodo, promedio, materias: CalificacionMateria[] }`
- `CalificacionMateria`: `clave`, `nombre`, `calificacion` (**string**, may be
  empty or non-numeric), `claveOportunidad`, `oportunidad`, `creditos`
- Progress: `progreso` (**plain number**, computed as approved/total credits)
  and `creditos { totales, faltantes }`
- Debts: `adeudos { tieneAdeudos, biblioteca, academico, escolar, financiero,
  administrativo }`
- Notices: `avisos: Aviso[] { titulo, mensaje, tipo }` with
  `tipo ∈ { "error", "warn", "info" }`

**Schedule** — `horario: HorarioMateria[]` (since v2.3.0):

- `HorarioMateria { clave, creditos?, grupo, docente, dias }`
- `dias` holds optional raw strings per weekday (`lunes`…`sabado`) observed as
  `"hh:mm-hh:mm SALÓN"` (time range + room code); empty days are omitted.
- `docente` concatenates the professor's surnames + names (`mape + mnom`).
- **The subject name is NOT included** — resolve it by joining `clave`
  against `boleta.materias[].clve → nombre`, falling back to the clave
  (implemented in `features/schedule/mapHorario.ts`). There is no dedicated
  classroom field; the room code is the third token of each `dias` string
  (`grupo` is not it).

## Session decision (this app)

Because every call needs credentials, the app keeps them **in React memory
only** for the lifetime of a session (`features/auth/AuthProvider.tsx`). They
are never written to `localStorage`, `sessionStorage`, IndexedDB, cookies, or
any other storage, and they are cleared on logout.

Consequence: refreshing data works while the app stays open; after a full
restart the student logs in again. Revisit this decision when the backend
offers a real session/token mechanism.

## Known gaps and future upgrades

1. **Subject name resolution depends on the boleta join.** If a horario
   subject has no matching boleta entry, the UI shows its clave. A cleaner fix
   belongs in the client (resolve names via retícula) or a richer API payload.
2. **No session/token mechanism.** Backend improvement candidate (TODO §3);
   until then refreshes require in-memory credentials.
3. **Plaintext hop remains.** The proxy fixes browser-facing mixed content/
   CORS, but the edge→SITH leg is still plain HTTP because the upstream offers
   nothing else.
4. **Type gotchas** — `calificacion` is a string; day strings are raw text
   parsed defensively (malformed/duplicate slots are skipped).
