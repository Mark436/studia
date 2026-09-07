# Aviso de reinscripción — fases

Bitácora del aviso local de reinscripción en
`lib/notifications/reinscripcion.ts`. Cada fase marca lo que se decide o se
implementa y deja anotado lo que falta por dictar, al estilo de la cápsula
(`docs/capsule-redesign.md`). Las fases pendientes quedan abajo en orden.

Contexto de datos: el API trae `alumno.fechaReinscripcion` en cada fetch. Es
una sola fecha por ciclo; es raro recibir una fecha válida y luego **otra**
válida. Lo normal es: se obtiene la fecha, y después esa misma fecha deja de
ser válida porque ya ocurrió. Cuando ya pasó más de un día, la fecha deja de
interesarnos del todo.

## Fases implementadas

### Fase 0 — Un solo aviso: `discovered`

- El aviso se reduce a **uno**, `discovered` ("Ya tienes fecha para tu
  reinscripción."), y solo cuando la fecha sigue en el futuro.
- Se anuncia una sola vez por fecha: al aparecer por primera vez o al cambiar
  entre dos fetchs reales. El estado `fired` se persiste por fecha
  (`SETTING_REINS_ALERTS_STATE`), así que no se repite en refrescos.
- Tipos: `ReinscripcionAlertKind = "discovered"` (antes unión con las
  ventanas y `start`). El mensaje vive en `REINSCRIPCION_ALERT_MESSAGES`,
  compartido por toast y push.

### Fase 1 — Fecha pasada ya no avisa

- `getReinscripcionAlert` devuelve `null` en cuanto la fecha ya ocurrió (o
  está ocurriendo al evaluarla): `fecha - ahora <= 0`.
- Se retiró el aviso `start` ("Tu turno de reinscripción ya empezó."): no
  queremos saber que la fecha se obtuvo si ya pasó.
- Que el tiempo pase **no re-arranca el contador**: pasar la fecha nunca
  re-arma un aviso nuevo. El "avísame una vez" queda atado al descubrimiento,
  no al momento en que la fecha ocurre.

### Fase 2 — Retiradas las ventanas previas

- Se eliminaron las ventanas T-24h y T-30min. "Solo se avisa 1 vez y es
  cuando se obtiene": si la fecha se obtiene futura, hay un aviso; nada más.
- El helper de línea de tiempo `getTimeUntilReinscripcion` se conserva
  intacto: sigue siendo la fuente para la `ReinscripcionCard` (Alumno y
  Avisos) y para la sección de prueba en dev, aunque ya no alimente avisos.

## 5. Fases del aviso de reinscripción — inventario

Evaluación en cada login/refresh real (`notifyNewReinscripcion`). Estados de
la fuente `lib/notifications/reinscripcion.ts`:

### 5.1 Sin fecha (`no-date`)

- `fechaReinscripcion` ausente, vacía o inválida → ni aviso ni card con
  cuenta; `getTimeUntilReinscripcion` devuelve `no-date`.

### 5.2 Fecha futura obtenida (`future`) → aviso `discovered` una vez

- Condición para avisar: la fecha todavía no ocurre **en el momento en que se
  evalúa** (por eso un `discovered` previo no se desdice ni se repite al
  pasar la fecha).
- Se dispara `discovered` si: no se anunció antes para esa fecha Y (es la
  primera vez que la vemos O cambió entre fetchs). Cambiar de una fecha válida
  a otra válida es raro, pero si llega, se trata como un descubrimiento nuevo.
- El toast in-app se muestra sin depender del opt-in; el push del sistema solo
  si el usuario está dado de alta y con permiso (mismo gate que adeudos).

### 5.3 Fecha en curso (`active`) — ya no avisa

- Una vez que la fecha ocurrió, ya no interesa notificar: el turno empezó o
  acaba de pasar. La card sigue mostrando "Tu turno de reinscripción va en
  curso" hasta 24 h después (estado `active` de la línea de tiempo), pero no
  se lanza ningún aviso.

### 5.4 Fecha pasada de > 1 día (`past`) — deja de interesar

- Pasadas las 24 h la línea de tiempo pasa a `past`; la card deja de mostrar
  la cuenta. El aviso nunca contempla esta etapa. Esto respeta el criterio de
  que "una fecha que ya ocurrió, si ya pasó un día, nos deja de interesar".

## Pendientes (para seguir dictando) + calibración abierta

1. **Reintroducir ventanas futuras (T-24h / T-30min)** si el flujo real las
   pide: serían avisos para una fecha todavía futura y se re-integran con la
   misma persistencia `fired` por fecha. Hoy retiradas por decisión de
   "solo se avisa 1 vez, cuando se obtiene".
2. **Push programado (`discovered` sin abrir la app)**: requiere backend con
   sesión/token (ver `docs/api.md` y ROADMAP §16).
3. **Mensaje `discovered`**: calibrar el copy ("Ya tienes fecha para tu
   reinscripción.") con el texto que el API usa para la reinscripción.