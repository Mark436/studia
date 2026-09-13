# Roadmap — Studia

## Pendientes inmediatos

Especificación completa de estas fases en [`docs/plan.md`](docs/plan.md):

- [x] **Fase A** — Mostrar el salón (código junto a la hora) en las tarjetas de clase en lugar del grupo.
- [x] **Fase B** — Pull-to-refresh; sin credenciales en memoria abre el formulario de reingreso.
- [x] **Fase C** — Home condicional: Calificaciones abre primero solo con cambios nuevos por ver y promedio del periodo ≠ 0.
- [x] **Fase D** — Recordatorio diario (una vez al día) para volver a iniciar sesión, con toast. _(Evolucionado: hoy es un nudge de datos obsoletos ≥ 23 h — solo toast sugiriendo pull-to-refresh; el sheet de reingreso ya no se abre solo.)_

## 0. Base del proyecto

- [x] Crear el proyecto con Vite + React + TypeScript.
- [x] Configurar TypeScript estricto.
- [x] Configurar el alias `@` para apuntar a `src`.
- [x] Configurar `vite-plugin-pwa`.
- [x] Crear el manifest de la PWA.
- [x] Añadir iconos de la aplicación.
- [x] Configurar el service worker.
- [x] Configurar estilos globales.
- [ ] Definir estrategia responsive mobile-first.
- [x] Configurar variables de entorno.
- [ ] Conectar el sitio de Netlify y definir `VITE_API_URL` en producción (apuntando a `/api/sith`).
- [x] Añadir `sith-api-client` como dependencia de runtime, no como `devDependency`.
- [x] Añadir función proxy de Netlify (`netlify/functions/sith-proxy.mts`) para evitar CORS/mixed-content — ver `docs/api.md`.
- [ ] Configurar el consumo del paquete local si se desarrolla junto con la PWA.
- [ ] Verificar compatibilidad de imports ES con extensión `.js`.

## 1. Arquitectura

### Estructura inicial

```text
src/
├── app/
│   ├── App.tsx
│   └── navigation.tsx
├── components/
│   └── ui/
├── features/
│   ├── auth/
│   ├── schedule/
│   ├── grades/
│   ├── student/
│   └── notifications/
├── lib/
│   ├── api/
│   ├── storage/
│   └── biometrics/
├── pages/
├── styles/
├── main.tsx
└── types/
```

- [ ] Mantener las features independientes entre sí.
- [ ] Evitar componentes React con lógica de negocio compleja.
- [ ] Mantener la lógica del horario separada de su representación visual.
- [ ] Mantener la lógica de autenticación separada de las pantallas.
- [ ] Utilizar named exports.
- [ ] Evitar default exports.
- [ ] Evitar `any`.
- [ ] Evitar abstracciones innecesarias.
- [ ] Mantener los componentes pequeños.
- [ ] Definir un flujo de dependencias claro: UI → Features → Domain/Services → `sith-api-client` → API.
- [ ] Los componentes no deben instanciar directamente `SithClient`.
- [ ] Centralizar la configuración del cliente API.
- [ ] Centralizar la carga y actualización de `AppData`.

## 2. Modelo de datos de la aplicación

- [ ] Crear un modelo de dominio independiente de la respuesta exacta de la API cuando sea necesario.
- [ ] Definir `AppData`.
- [ ] Definir estado de carga.
- [ ] Definir estado de error.
- [ ] Definir estado autenticado/no autenticado.
- [ ] Definir fecha y hora de última actualización.
- [ ] Definir estructura de datos para:
  - [ ] alumno
  - [ ] horario
  - [ ] calificaciones
  - [ ] avisos
  - [ ] adeudos
  - [ ] progreso
  - [ ] `loadedAt`
- [ ] Crear mapeadores solo si los tipos de la API y del dominio necesitan estar desacoplados.
- [ ] Evitar duplicar tipos que ya estén correctamente definidos en `sith-api-client`.

## 3. Autenticación

### Primer acceso

```text
Usuario + contraseña
↓
SithClient
↓
Datos del alumno
↓
Sesión de la aplicación
```

- [x] Crear pantalla de login.
- [x] Añadir campo de usuario.
- [x] Añadir campo de contraseña.
- [x] Implementar validación básica.
- [x] Definir estado de loading.
- [x] Mostrar errores de autenticación.
- [x] No persistir la contraseña en localStorage.
- [x] No persistir la contraseña en sessionStorage.
- [x] No persistir la contraseña en IndexedDB.
- [x] Definir logout.
- [ ] Definir expiración de sesión.
- [x] Definir comportamiento al recargar la PWA (se restauran los datos cacheados; sin contraseña guardada, se pide reingreso al actualizar).
- [x] Recordar el usuario (nunca la contraseña) para agilizar accesos posteriores.
- [x] Reingreso sin perder la sesión: un fallo durante la revalidación mantiene los datos en pantalla y reporta el error dentro del sheet (con usuario prellenado); el nudge de datos obsoletos (≥ 23 h) es solo un toast que sugiere pull-to-refresh, el sheet ya no se abre automáticamente.

### Accesos posteriores

- [ ] Investigar WebAuthn/passkeys.
- [ ] Diseñar flujo de acceso mediante biometría.
- [ ] Determinar cómo se relacionará la credencial biométrica con la autenticación de la API.
- [ ] Si la API requiere actualmente `user + pass` para cada consulta, evaluar una sesión/token como mejora del backend.
- [ ] No intentar almacenar la contraseña cifrada en el frontend como sustituto de una sesión segura.

## 4. Persistencia local

### Objetivo

```text
Abrir aplicación
↓
¿Hay datos locales?
↙          ↘
Sí          No
↓          ↓
Mostrar datos locales   Mostrar Login
↓
Intentar actualizar
```

- [x] Evaluar IndexedDB para persistencia.
- [x] Persistir datos académicos.
- [x] Persistir `loadedAt`.
- [x] No persistir credenciales.
- [x] Mostrar inmediatamente los últimos datos disponibles.
- [x] Intentar actualizar cuando corresponda (pull-to-refresh).
- [ ] Manejar aplicación offline.
- [ ] Mostrar claramente cuando los datos mostrados son antiguos (el indicador previo se retiró; pendiente decidir reemplazo ligero).
- [x] Invalidar datos locales cuando sea necesario (logout borra todo el almacenamiento).

## 5. Navegación

### Áreas principales

- Horario
- Calificaciones
- Alumno

- [x] Crear bottom navigation mobile-first.
- [x] Crear navegación entre las tres áreas.
- [x] Utilizar iconos coherentes.
- [x] Mantener la navegación accesible.
- [x] Añadir estados activo/inactivo.
- [x] Respetar safe areas de dispositivos móviles.
- [x] Definir pantalla principal dinámica.
- [x] Horario es el Home por defecto.
- [x] Calificaciones abre como Home solo con cambios nuevos por ver y promedio del periodo ≠ 0.
- [x] Crear una función o lógica independiente para determinar el Home.
- [ ] Intercambiar también icono y etiqueta según el estado de Home.
- [x] Mantener acceso al resto de las áreas.
- [ ] No duplicar la lógica de navegación dentro de cada pantalla.

## 6. Horario

### Vista diaria

- [x] Bloqueo resuelto: `sith-api-client` ≥2.3 expone el horario (`Alumno.horario`); el nombre de materia se resuelve con la boleta — ver `docs/api.md`.
- [x] La pantalla principal del horario debe representar el día como una timeline vertical.
- [x] Mostrar el día actual inicialmente.
- [x] Mostrar las clases del día.
- [x] Mostrar hora de inicio.
- [x] Mostrar hora de finalización.
- [x] Ocultar clases completamente terminadas.
- [x] Mantener visible la clase actualmente en curso.
- [x] Mostrar la siguiente clase.
- [x] Destacar visualmente la clase actual.
- [x] Reducir prioridad visual de las clases futuras.
- [x] Mostrar ubicación/aula si existe.
- [x] Mostrar profesor si existe.

### Hora actual

- [x] Mostrar indicador de hora actual.
- [x] Posicionar la línea según la hora real.
- [x] Actualizar la posición periódicamente.
- [x] No actualizar cada segundo si no es necesario.
- [x] Alinear el temporizador al borde del minuto real (recalcula exactamente cuando cambia el minuto relevante).
- [x] Pausar actualizaciones innecesarias cuando la aplicación esté en background.
- [x] Recalcular al volver a foreground.
- [x] Mantener la clase actual correctamente aunque la hora cambie.

### Cuenta regresiva de la siguiente clase

- [x] Mostrar tiempo relativo ("20 min", "1 hr y 30 min"; se omiten los valores en cero).
- [x] Mostrar "Empieza pronto" en el minuto exacto de inicio.

### Progreso de clase

- [x] Calcular porcentaje de progreso.
- [x] Representar visualmente el progreso.
- [x] Mostrar tiempo restante.
- [x] Evitar errores en clases que cruzan cambios de hora/día.

### Edición y personalización del horario

- [x] Editar materia (nombre, profesor, salón) manteniendo presionada la tarjeta o con el botón de lápiz; duración de la presión larga configurable desde modo dev.
- [x] Editar el horario de una ocurrencia específica (día) sin afectar las demás.
- [x] Agregar materias manuales (p. ej. Inglés) con días y rango horario.
- [x] Eliminar materias agregadas manualmente.
- [x] Persistir ediciones y materias manuales en IndexedDB (sobreviven recargas; se borran con logout).
- [x] Resolver empalmes: cada materia empalmada se muestra como su propia tarjeta con una nota al pie ("Encimada 1/2 por Matemáticas" / "Encimada completa por Matemáticas"); las clases no empalmadas pasan intactas.
- [x] Fracciones amigables en la nota (1/4, 1/3, 1/2, 2/3, 3/4) con respaldo en minutos; cobertura total se indica como "completa".
- [x] Sin reordenamiento/swap entre empalmadas: la nota es informativa y no hay alternancia de orden (se eliminó la preferencia semanal/diaria de empalme).
- [x] Botón circular "+" (solo icono) para agregar materia, reemplazando el botón con texto.
- [x] Validación por campo en el editor (nombre vacío, rango inválido, sin días) con mensajes junto a cada campo y `TimeInput` dedicado; al corregir el error desaparece al instante.
- [x] Al crear una materia, el horario salta al primer día seleccionado y muestra un toast de éxito.
- [x] Presión larga con umbral por defecto de 550 ms (`DEFAULT_LONG_PRESS_MS`); la web no puede leer el umbral del sistema operativo (limitación documentada en `docs/app-flow.md`).
- [x] Reconciliación de ediciones manuales vs. cambios de la escuela (drift): tras cada fetch real se comparan los campos de texto contra la línea base guardada; los choques con ediciones vivas persisten como conflictos pendientes y se resuelven en un sheet ("Usar el nuevo" / "Conservar el mío"). Pausado durante simulación dev.

### Navegación entre días

- [x] Implementar swipe horizontal (sobre la zona de la lista).
- [x] Swipe hacia izquierda → siguiente día.
- [x] Swipe hacia derecha → día anterior.
- [x] El área de swipe cubre todo el alto (flex chain del shell: `main`/transform/`Page` crecen) para que el gesto responda también en días sin clases.
- [x] Alternativa no-gestual: menú de 3 bolitas (anterior / seleccionado / siguiente) con click.
- [x] La ventana de 3 bolitas sigue al día seleccionado (scroll infinito, el centro es el día en pantalla).
- [x] Mantener navegación táctil fluida.
- [ ] Animar la transición entre días de forma sutil.
- [x] Permitir navegar a otros días disponibles.

### Vista de dos días

- [ ] Diseñar modo de dos días.
- [ ] Mostrar ambos días completos.
- [ ] Evaluar si funciona correctamente en pantallas pequeñas.
- [ ] Considerar scroll horizontal.
- [ ] Mantener la vista diaria como modo predeterminado.
- [ ] Añadir selector para cambiar entre 1 día y 2 días.

## 7. Calificaciones

- [x] Crear pantalla de calificaciones.
- [x] Mostrar promedio.
- [x] Mostrar materias.
- [x] Mostrar calificación por materia.
- [x] Mostrar período/semestre cuando esté disponible.
- [ ] Mostrar créditos relacionados cuando estén disponibles.
- [x] Crear state sin calificaciones.
- [ ] Crear loading state.
- [ ] Crear error state.
- [ ] Evaluar historial de calificaciones si la API lo permite.
- [x] Detectar cambios entre consultas (materia nueva o calificación modificada) mediante seguimiento local (`TrackedGrade`, sin fechas).
- [x] Aviso tipo toast (verde) cuando una actualización real detecta calificaciones nuevas o modificadas.
- [x] Abrir Calificaciones como Home solo con cambios nuevos por ver y promedio del periodo ≠ 0.
- [ ] Intercambiar posición, icono y etiqueta de navegación.
- [x] No mostrar una pantalla vacía cuando todavía no existan calificaciones.

## 8. Alumno

### Información general

- [x] Crear pantalla de alumno.
- [x] Mostrar nombre.
- [ ] Mostrar matrícula.
- [x] Mostrar carrera.
- [x] Mostrar semestre.
- [ ] Mostrar campus.
- [ ] Mostrar otros datos relevantes disponibles.

### Progreso académico

- [x] Mostrar progreso total de la carrera.
- [x] Mostrar porcentaje.
- [ ] Mostrar créditos aprobados.
- [ ] Mostrar créditos en curso.
- [ ] Mostrar créditos restantes.
- [x] Mostrar semestre actual.
- [ ] Mostrar progreso por semestre si la información lo permite.
- [x] Crear componente visual de progreso.
- [x] Notificar avance de carrera: toast in-app y notificación local opcional (mismo opt-in que adeudos) cuando `progreso` aumenta entre fetchs reales, indicando cuánto subió.
- [ ] Evitar presentar información académica redundante.

## 9. Avisos

- [ ] Mostrar avisos relevantes en Home.
- [ ] Diferenciar avisos importantes de informativos si existe esa información.
- [ ] Crear estado sin avisos.
- [ ] Evitar que los avisos dominen la interfaz.
- [ ] Evaluar posteriormente notificaciones push.

## 10. Adeudos

- [x] Tratar los adeudos como una alerta principal, no como una sección central.
- [x] Detectar adeudos al cargar `AppData`.
- [x] Lista «Deudas» en Alumno: estado «Sin deudas por el momento» cuando no existen y detalle específico por área cuando sí; reemplaza el banner descartable del shell.
- [x] No añadir Adeudos como tab principal.
- [x] Permisos de detalle por área con la lista «Deudas» (cada región con su texto).
- [x] Ocultar el aviso principal cuando no existan adeudos (la tarjeta de Alumno muestra su estado).
- [x] Alerta local opcional al aparecer un adeudo nuevo (opt-in, solo transición sin→con adeudo).
- [x] Aviso tipo toast in-app (rojo) en la misma transición sin→con adeudo, independiente del opt-in de notificaciones del sistema.
- [ ] Evaluar posteriormente notificaciones push para adeudos (requiere backend con sesión/token; ver `docs/api.md`).

## 11. Actualización de datos

- [ ] Definir política de actualización manual y automática.
- [x] La actualización manual es mediante pull-to-refresh (gesto principal).
- [x] Alternativa accesible no-gesto: acción "Actualizar" en la sección Alumno (el gesto no es el único camino).
- [ ] La actualización automática se activará al abrir la app, al hacer login y cuando haya datos vencidos.
- [ ] Definir la estrategia de invalidación de caché cuando cambien los datos.
- [ ] Mostrar claramente el estado de última actualización.
- [ ] Definir cooldown o throttling para evitar solicitudes repetidas.
- [ ] Manejar errores de red y tiempos de espera.
- [ ] Cuando no haya conectividad, mostrar datos locales con una advertencia visual.
- [ ] Completar la lógica de reintento cuando la conexión vuelva.

## 12. Calidad y UX

- [ ] Revisar accesibilidad básica: contraste, foco, tamaños de toque, lectura por pantalla.
- [ ] Validar experiencia mobile-first y evitar layouts frágiles en pantallas pequeñas.
- [ ] Revisar estados vacíos, loading y error en cada pantalla.
- [ ] Probar navegación con teclado y gesto táctil.
- [ ] Revisar rendimiento y evitar renders innecesarios.
- [ ] Documentar decisiones de arquitectura y flujo de datos.

## 13. Modo dev (herramientas de prueba)

- [x] Panel en Alumno activado con 7 taps sobre el nombre (en builds dev visible por defecto). Sin chequeo de dueño: las credenciales del API son la única barrera real; el panel solo oculta UI.
- [x] Botón «Cerrar modo dev»: oculta el panel hasta repetir los 7 taps, pausa la simulación y conserva la configuración guardada.
- [x] Reloj simulado (offset/datetime) que alimenta hora, día, clase en curso y progreso.
- [x] Agregar/quitar materias del horario (solo presentación).
- [x] Editar calificaciones simuladas por materia.
- [x] Toggle de adeudos (banner y alertas).
- [x] Config persistida en settings store con botón "Restaurar datos reales".
- [x] Sección de pruebas de toast: variante y mensaje arbitrarios (los estados nuevos aparecen solos al registrarse en `TOAST_VARIANTS`).
- [x] Slider de duración del toast (1–10 s); aplica solo con el panel abierto (pausa al cerrar, igual que el resto de overrides). La duración de presión larga se movió a Ajustes (siempre activa, ver §14.1).
- [x] Toast con desvanecimiento de salida y temporizadores que no se reinician con re-renders del host.
- [x] Los toggles de calificaciones y adeudos disparan los toasts reales de producción (mismo texto y variante que un fetch real), a través del mismo `onShowToast` del shell.
- [ ] Evaluar retirar el panel antes de compartir la app con otros alumnos.

## 13.1 Pruebas

- [x] Configurar vitest (`pnpm test`).
- [x] Pruebas de lógica pura del horario: cuenta regresiva, selección de clase actual/siguiente en el minuto exacto, `parseMinutes`/`formatMinutes`.
- [x] Pruebas de resolución de empalmes: agrupamiento, prioridad, fracciones amigables y preferencias de alternancia.
- [x] Pruebas de aplicación de ediciones y validación de la persistencia del horario.
- [x] Pruebas de reconciliación de drift (`collectSubjectFields`, `detectManualEditConflicts`, fusión de conflictos) y de las nuevas formas persistidas (snapshots, conflictos pendientes).
- [x] Pruebas de sincronización del temporizador por minuto (`msUntilNextMinute`, independiente de zona horaria).

## 14. Sistema de diseño

Fuente de verdad: [`docs/design.md`](docs/design.md).

- [x] Tokens semánticos dual-theme (`prefers-color-scheme`) vía `@theme inline`.
- [x] Tipografías self-hosted: Schibsted Grotesk (display) + General Sans (UI).
- [x] Receta liquid glass con fallback sólido (`glass-panel`, `glass-panel-accent`).
- [x] Restyle de primitivas: Button, Card, Badge, Input, Toast, ProgressBar.
- [x] Bottom navigation como píldora glass flotante.
- [x] Cápsula de contexto: primitiva `Capsule` (GSAP Flip) + estados de horario.
- [x] Eventos importantes de expansión: cambio de clase, T-60 min, T-1 min; auto-colapso 1.5 s.
- [x] Variantes A/B de cápsula con toggle en modo dev + slider de colapso.
- [x] Cápsula persistente en todo el shell (`ContextCapsule` vía `topSlot`); expansión centrada.
- [x] Estado compartido del horario (`ScheduleStateProvider`) entre cápsula y página.
- [x] Canal de avisos cápsula/toast: el flash es un solo aviso transitorio (título + conclusión colapsada, detalle al expandir; pop bouncy + parpadeo al llegar, auto-clear 10 s); calificación nueva, adeudos, progreso y reinscripción.
- [x] Promedios con máximo 2 decimales (`formatAverage` + `AnimatedNumber`).
- [x] Headers de página retirados; la barra inferior orienta la sección.
- [x] Números héroe animados (promedios, progreso) con GSAP.
- [x] Branding PWA: manifest Studia + theme-color por esquema.
- [x] Pruebas de la lógica pura de la cápsula (`capsuleState.test.ts`).
- [x] El morph usa un tween geométrico de GSAP (`left`/`xPercent`/radio), sin Flip; el anchor (contador+salón) permanece en su lugar al expandir.
- [x] Variante por defecto: **B · Morf iOS** (modo dev cierra/abre el panel con su propio toggle).
- [ ] Rediseñar iconos PWA al lenguaje cobalto.
- [ ] Auditoría de contraste AA en ambos temas.

## 14.1 Ajustes (personalización)

Pantalla de preferencias del usuario en el área Alumno, desacoplada de dev mode.

- [x] Bottom sheet "Ajustes" accesible desde Alumno (tarjeta "Personalizar").
- [x] Desacoplar preferencias de usuario de `DevConfig`: canal de avisos, variante de cápsula, colapso automático y duración de presión larga ahora aplican **siempre**, no solo con el panel dev abierto.
- [x] Control persistente de alertas de adeudos (switch), reutilizando el opt-in existente.
- [x] Control para guardar o no el número de control (switch de privacidad); `AuthProvider` persiste el usuario solo si está activado.
- [x] Migración automática desde el viejo `DevConfig` a `UserSettings` en el primer arranque.
- [x] Primitivas UI `Switch` y `SegmentedControl` en `components/ui/`.
- [x] Pruebas de `parseUserSettings` (`settings.test.ts`).

## 15. Criterio de finalización

- [ ] La app puede iniciar en modo PWA.
- [ ] El usuario puede iniciar sesión correctamente.
- [ ] El horario se muestra y actualiza según la hora real.
- [ ] Las calificaciones aparecen con estado vacío y error definidos.
- [ ] La navegación principal funciona en mobile.
- [ ] Los datos se guardan y restauran localmente sin exponer credenciales.
- [ ] El flujo offline/online está definido y es visible para el usuario.

## 16. Notificación de reinscripción

Aviso local (mismo gate de opt-in y permisos que adeudos/progreso) sobre la
fecha de reinscripción (`alumno.fechaReinscripcion`), que el API trae en cada
fetch. Se evalúa en cada login/refresh; solo avisa una fecha que siga en el
futuro cuando se obtiene.

- [x] Aviso único `discovered` cuando llega una fecha válida (todavía futura), una sola vez por fecha.
- [x] Una fecha ya ocurrida (o que ocurre al evaluarla) no avisa; que pase el tiempo no re-arranca el aviso.
- [x] Los antiguos avisos de ventana (T-24h, T-30min) y `start` se retiraron del flujo; ver `docs/reinscripcion-redesign.md`.
- [x] Toast in-app (independiente del opt-in) y cápsula, por el canal configurable.
- [x] Helper puro `getTimeUntilReinscripcion` (estado futuro/activo/pasado/sin-fecha) + `ReinscripcionCard` en Alumno y en la pestaña Avisos; la línea de tiempo sigue validando la fecha aunque haya pasado.
- [x] Pestaña "Avisos" en la navegación inferior.
- [x] Sección de prueba en dev (`ReinscripcionTestSection`): ver cuánto falta según escenario (24h/30min/empezó/pasó/sin fecha), combinable con el reloj simulado.
- [x] Pruebas de la lógica pura con reloj inyectado (`reinscripcion.test.ts`).
- [ ] Evaluar push programado en segundo plano (futuro `discovered` sin abrir la app): requiere backend con sesión/token; ver `docs/api.md`.

## 17. Sugerir horario + búsquedas diarias (rama `test/sugerir-horario`) — PLAN

Objetivo: cuando el instituto publique el calendario, y luego el prehorario de la
carrera, la app lo detecte sola (búsqueda diaria) para poder sugerir un horario
antes de la inscripción.

### Logrado en esta rama
- [x] Descubrir el prehorario de la carrera desde el listado público de
  `ith.mx/documentos/` ordenado por modificación (`?C=M;O=D`), con desempate
  por recencia cuando el nombre está cerca (umbral de tokens) y **jamás** un
  prehorario de otra carrera (`src/lib/prehorario.ts` + tests).
- [x] Calcular las materias por cursar desde la retícula (`getMateriasPendientes`,
  estados acreditados = 2/3/4 vía `codigoEstado`).
- [x] URL canónica del prehorario elegido (`urlPrehorario`).
- [x] Fecha de modificación de cada archivo del listado (`parseArchivosConFecha`);
  el botón de prehorario y el nuevo de calendario la validan contra `getNow()`
  (reloj del modo dev) con una ventana de 7 días.
- [x] **Detección del calendario desde la página oficial en vacaciones**
  (restaurado 2026-09-10; **revierte la decisión del 2026-09-08** de usar el
  listado — el listado ignoraba `?C=M;O=D`, elegía el calendario 2024 y las
  fechas volvían vacías): el chequeo consulta `calendario-escolar.html` (vía
  mirror `https://api.marcosochoa.dev/ith/`) a lo sumo cada 7 días y toma el
  calendario vigente embebido (`obtenerCalendarioOficial` /
  `parseCalendarioOficial` en `src/lib/prehorario.ts`). Al detectar uno
  distinto al procesado lo aplica **silenciosamente** (sin toast). Sin
  ventanas anuales: la cadencia la controla el chequeo, no una ventana de días
  sobre el archivo.
- [x] `elegirCalendario` / `esCalendario` (detección por listado) se
  **eliminaron**; `obtenerCalendarioOficial`, `parseCalendarioOficial` y
  `interpretarFuenteCalendario` operan sobre la página oficial
  `calendario-escolar.html` (decisión del dueño: el calendario sale de la
  página oficial, no del listado).
- [x] Prueba de **calendario** en el harness del pipeline
  (`PruebaCompletaSection`): el paso 1 consulta la página oficial con
  `obtenerCalendarioOficial()` (mismo mecanismo del chequeo diario) y el paso
  2 lee las fechas del PDF con pdfjs (inicio de labores, actividad 5 y fin de
  clases).
- [x] El extractor de fechas tolera el **espaciado letra a letra** del PDF
  (`P E R IODO`, `F i n de cl as es`, `20 26`) y `extraerFinDeClases` compara
  todas las filas de «fin de clases» (licenciatura vs idiomas) en vez de solo
  la primera (`src/lib/calendarioLabores.ts`).
- [x] **Desempate por tokens distintivos**: se descartan los genéricos
  (INGENIERIA, LICENCIATURA, EN, E, DE, DEL, LA, EL, UN, UNA, AL), los nombres
  sin espacio se parten por el punto (`ING.INFORMATICA` → ING + INFORMATICA) y
  `LIC` se expande a LICENCIATURA (de nuevo genérica). Regresión: «ING. EN
  AERONÁUTICA» gana su prehorario y no lo roba el de ISC (inflación por
  EN/INGENIERIA).
- [x] **Máquina de fases del chequeo diario** (`src/lib/busquedaHorarios.ts`,
  lógica pura): sin ventanas anuales. La búsqueda del calendario del ciclo
  siguiente corre dentro de la **ventana vacacional** (`fechaFinDeClases` →
  `fechaInicioLabores`): `procesar-calendario` (aplicar las fechas del PDF
  nuevo) → `buscar-calendario` (consultar la página oficial, mínimo 7 días
  entre consultas) → al salir de vacaciones `esperar-prehorario` hasta la
  **fecha de la actividad 5** (fallback labores + 1 día) → `buscar-prehorario`
  →
  `completado`; `sin-datos` cuando no hay calendario procesado. Un calendario
  nuevo detectado manda sobre el resto y reinaugura el ciclo. Migración del
  estado de los ciclos con ventanas: `calendarioVisto` se asume ya procesado y
  el fin de clases se completa on-demand (`obtenerDatosCalendario`).
  **Sin gate de horas**: el estado persiste (IndexedDB) y el avance **no
  depende de una sesión actualizada**.
- [x] **Harness de prueba en modo dev**: sección «Chequeo diario» con botón
  **«Validar fecha (+24h)»** que simula el evento aunque la sesión esté
  desactualizada, input para fijar la fecha de inicio de labores y botón de
  reinicio; cruza con `getNow()` (reloj del modo dev) y ejecuta la acción de la
  fase (fetch del calendario oficial / del prehorario, según toque).
- [x] **Leer el calendario oficial** (pdfjs, import dinámico): `leerFechasInicioLabores`
  extrae las fechas de «inicio de labores» del PDF y `extraerFechasPublicacionPrehorarios`
  la de la **actividad 5** (publicación de orden de reinscripción + Prehorarios):
  día en la celda, mes por encabezado de columna, año del periodo. La fase
  `procesar-calendario` guarda ambas (`fechaInicioLabores` /
  `fechaPublicacionPrehorarios`), más el **fin de clases** del periodo en curso
  (`extraerFinDeClases`, la fila «Fin de clases» más tardía — sin la regla +1
  año); el fin de clases delimita la ventana vacacional que dispara la
  búsqueda del calendario siguiente. La fecha de la actividad 5 dispara
  `buscar-prehorario` y el aviso de **turnos de reinscripción**.
  - Regla de año de labores: el ciclo inicia en agosto; meses < 8 pertenecen al
    ciclo siguiente (corrige el «6 de enero 2026/2027» del PDF). La actividad 5
    **no** sufre esa regla (siempre está en el primer mes del periodo).
  - `parseCalendarioOficial` elige el **calendario vigente** (mayor año) cuando
    la página embebe varios PDFs.
- [x] **Transporte resuelto (diagnóstico 2026-08 → espejo 2026-09)**: `ith.mx`
  es inalcanzable desde el datacenter de Netlify (ETIMEDOUT), pero el repositorio
  completo (`/documentos/` con CORS y `?C=M;O=D`, PDFs, y
  `ith.mx/calendario-escolar.html`) está espejado en
  `https://api.marcosochoa.dev/ith/`. Se eliminaron el proxy
  `netlify/functions/ith-proxy.mts` y las rutas `/api/ith`, `/documentos` y
  `/calendario-escolar.html` de `vite.config.ts`; `prehorario.ts` y
  `pdfTexto.ts` apuntan directo al espejo. No hace falta relay en producción.
  El espejo limita a 30 peticiones por usuario cada 10 s (HTTP 429): los fetch
  de listado y PDF pasan por `fetchConReintento` (`src/lib/fetchConReintento.ts`),
  que ante un 429 espera `Retry-After` (o 10 s) y re-intenta hasta 3 intentos.

- [x] **Lectura de PDF separada del calendario**: `leerTextoPDF` /
  `urlDocumentoPdf` viven en `src/lib/pdfTexto.ts` (worker de pdf.js), sin
  lógica de calendario; `leerFechasInicioLabores` solo interpreta fechas sobre
  ese texto. Prueba en modo dev: «Probar PDF de prehorario (texto)» descarga
  el prehorario de la carrera y muestra las primeras líneas extraídas para
  decidir el JSON de las tablas.
- [x] **Leer el PDF del prehorario → JSON de tablas**: `leerRenglonesPDF` en
  `src/lib/pdfTexto.ts` extrae el texto **con posiciones (x, y)** porque el
  texto plano pierde las columnas. `procesarPrehorarioTexto` en
  `src/lib/prehorarioTablas.ts` agrupa por fila (umbral vertical ~6 pt),
  clasifica celdas por zona de columna (Clave, Gpo, Materia, T, P, C, HRS,
  MAESTRO, AULA, Lun..Vie), une la clave cuando va debajo de sus datos y
  reensambla maestros/aulas que envuelven, y devuelve el mismo formato que
  `samplegrupos.json`: `{ S5: { materias: [{ clave, nombre, horas, creditos,
  grupos: [{ grupo, paquete, turno, especialidad, maestro, aula, horario }] }] } }`
  (horas `"07:00-08:00"`, claves de día `lunes..viernes`). El botón «Probar
  retícula + prehorario» ahora también imprime ese JSON en el pre de devtools.
  Validado contra el PDF real de ISC 2026-2 (5 semestres, 43 materias, 121
  grupos) y con `prehorarioTablas.test.ts`. Nota: el agrupado por `S#` deriva
  del GPO; paquete/turno/especialidad son best-effort de la cabecera de sección
  más reciente (la atribución exacta no siempre es posible).

### Pendiente (plan)
- [ ] **Generar sugerencias de horario**: combinar materias pendientes con los
  grupos del prehorario para proponer un horario (criterios por definir:
  sin choques, bloques, carga por día, etc.).
  - [x] **Materias que tocan ya**: `getMateriasDisponibles` en
    `src/features/student/reticulaPendiente.ts` decide qué materias pendientes
    tienen su seriación satisfecha con la retícula actual (cada grupo «o»
    exige UNA coordenada acreditada; AND entre grupos). No corta por
    `alumno.semestre`, así que sirve para alumnos regulares y con materias
    adelantadas. `x` (semestre) y `y` (fila) son las coordenadas de la
    retícula del API; la seriación viene en `r` → `seriacion`. El botón
    «Probar sugerencia de horario» lista pendientes, marca ✅ las que tocan ya
    / ⛔ las bloqueadas (con su explicación) y solo busca en el prehorario las
    disponibles. Ver `reticulaPendiente.test.ts`.
  - [x] **Algoritmo de sugerencia v1** (`src/lib/sugerirHorario.ts` + tests):
    restricción dura **sin choques**, maximiza materias cubiertas y minimiza
    huecos entre clases; las excluidas llevan razón (`sin-grupos-en-prehorario`
    / `no-cabe-sin-choque`). Lógica pura, determinista (orden de entrada como
    desempate); la función de puntaje es el punto de extensión para criterios
    futuros.
  - [ ] Criterios futuros de puntaje (evitar maestro, tamaño máximo de hueco,
    priorizar horas) y UI para configurarlos; dónde se consume (harness dev /
    área Alumno) pendiente de decidir. Ver `docs/sugerir-horario.md` §7.

### Búsquedas diarias (mismo listado `ith.mx/documentos/`)

Catálogo central de **eventos, disparadores y cadencias**: [`docs/sugerir-horario.md`](docs/sugerir-horario.md).

- [x] Chequeo diario implementado como fases (vacaciones → calendario → labores
  → actividad 5 prehorario → completado) **anclado a las 18:00**, sin gate de
  horas; estado persistido y testeable desde el modo dev sin esperar fechas.
- [x] Disparador "diario" en producción: `useHorariosCheck` corre al abrir la
  app, al volver a foreground (`visibilitychange`/`pageshow`/`focus`), al
  recuperar la conexión (`online`) y con un **timer que re-agenda el próximo
  18:00** (`proximoMomentoChequeo`) mientras la app está abierta. Antes de las
  18:00 no toca el API. En el working tree, sin commitear.
- [x] **Guard de modo offline** en el chequeo diario: sin conexión no se busca
  ni se persiste; el listener `online` vuelve a disparar — ver
  `docs/sugerir-horario.md` §2.
- [x] Cadencia de la búsqueda del calendario en vacaciones: la página oficial
  `calendario-escolar.html` (`obtenerCalendarioOficial`) se consulta a lo sumo
  **cada 7 días** (`diasEntreBusquedasCalendario`, gate
  `pasoTiempoBusquedaCalendario`) dentro de la ventana vacacional y sin límite
  de antigüedad sobre el archivo; al salir de vacaciones (inicio de labores)
  se detiene. En clases, la fase `buscar-prehorario` se re-evalúa cada chequeo
  con la **fecha de la actividad 5**; el fallback `labores + 1 día` solo aplica
  si el PDF no trae la actividad.
- [x] **Detección silenciosa**: el calendario nuevo detectado en vacaciones se
  aplica sin toast; el aviso existe solo para el prehorario de la carrera
  (1 vez por archivo).
- [x] **Aviso de turnos de reinscripción**: cuando la fecha de la actividad 5
  es hoy o ya pasó, el bucle de las 18:00 avisa una sola vez
  (`avisoTurnosEnviado`) y el nudge de refrescar lo menciona al sugerir
  actualizar datos. No existe un archivo «SIG»: la detección del calendario es
  por la **página oficial** (`calendario-escolar.html`) durante las vacaciones.
