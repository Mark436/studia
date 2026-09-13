# Modo dev: API Mock (cómo funciona ahora)

> Actualizado: 2026-09-12 · Reemplaza al viejo sistema de "overrides de
> presentación" (`applyDevOverrides`), eliminado.

## Qué es

El panel de modo dev permite **simular los datos académicos completos** sin
tocar el servidor real. En vez de parchear las pantallas por encima (como hacía
el antiguo sistema de overrides), el modo dev **sustituye la fuente de datos**:
con la API en Mock, la app pide los datos a una API falsa (`TestSithApi`) que
devuelve un estado mutable, sembrado desde la última copia en caché. Todo lo
que la app hace en producción (fetch → persistir → detectar cambios → toast)
aplica igual, pero sobre datos simulados.

Esto tiene una consecuencia importante: **los cambios no se ven al instante**;
se aplican al hacer **pull-to-refresh**, cuando la app vuelve a pedir los datos
y el pipeline real detecta las diferencias (toast de calificaciones, de adeudo,
de reinscripción, de progreso, etc.).

## Cómo se abre y se cierra

- **Build de desarrollo** (`pnpm dev`): el panel aparece habilitado por
  defecto.
- **Producción**: se desbloquea con **7 taps sobre el nombre del alumno** en la
  pestaña *Estudiante* (`UNLOCK_TAP_COUNT = 7`). Al cerrar se guarda un estado
  "habilitado = false" explícito, así el panel queda oculto en los siguientes
  arranques hasta que se re-desbloquee.
- **Cerrar**: botón **"Cerrar modo dev"** al final del panel.

Al cerrar el panel **todo se destruye**: se apaga la API falsa (vuelve a
Real), se borra el estado mock y se resetea el reloj. Los datos simulados
**no persisten** entre sesiones; la próxima vez se vuelven a sembrar desde la
caché.

## Estructura del panel

```
Modo dev                            ← encabezado (con badge Simulación activa/Inactivo)
├── API                             ← LOS TOGGLES VAN HASTA ARRIBA
│   └── Sith API: [ Real | Mock ]   ← único toggle hoy; futuro hogar de más APIs
│
├── (con la API en Mock)
│   ├── Aviso: "Los cambios aplican al hacer pull-to-refresh (solo el Reloj es instantáneo)"
│   ├── Datos del alumno            ← nombre, número de control, carrera, semestre
│   ├── Materias                    ← agregar/quitar materias simuladas
│   ├── Calificaciones              ← editar calificación por materia
│   ├── Adeudos                     ← "Con adeudo" / "Sin adeudo"
│   ├── Reinscripción               ← fecha vía presets relativos o fecha exacta
│   └── Avisos                      ← agregar aviso de prueba
│
├── Reloj                           ← solo funcional con la API en Mock
├── Prueba completa del pipeline
├── Notificaciones                  ← compositor de aviso de cápsula
├── Toasts                          ← playground de toasts + duración
└── [ Restaurar datos reales ] [ Cerrar modo dev ]
```

## El toggle de API (hasta arriba)

El interruptor **Sith API Real/Mock** es el punto de control central y está
primero en el panel. Al pasar a **Mock**:

1. `DevTestEnvironment.setSithMode("mock")` cambia la fuente de datos.
2. `useSithApi()` pasa a devolver `TestSithApi`; `useClock()` pasa a devolver
   `FakeClock`.
3. Aparecen las secciones de edición de datos simulados.

Al volver a **Real** se restaura la API y la hora real (se descarta cualquier
desplazamiento del reloj).

## Qué se puede editar y cómo muta el estado

Todo el estado mock vive en `DevTestEnvironment` (`src/lib/devtest/`),
sembrado desde `CachedAppData` (IndexedDB) en `activate()`/`reset()`. Cada
método de mutación (`updateGrade`, `addMateria`, `removeMateria`,
`setAdeudos`, `setAdeudosPresent`, `setMockReinscripcionDate`, `addAviso`,
`setMockAppData`) notifica a React (vía `subscribe()`), de modo que el panel
se actualiza al instante y los hooks `useSithApi`/`useClock` reaccionan al
modo sin recargar.

> **Nada de esto dispara notificaciones al editar.** Editar materias,
> calificaciones, adeudos, reinscripción o avisos solo cambia los datos mock;
> los toasts/avisos los suelta el **pipeline real al hacer pull-to-refresh**
> cuando detecta la diferencia. La única excepción es el **Reloj**, que es
> instantáneo: mover la hora actualiza horario, cuenta regresiva y tarjeta de
> reinscripción al momento, sin refresh.

| Sección | Botón/control | Mutación mock | Se ve después de… |
| --- | --- | --- | --- |
| Datos del alumno | campos nombre / control / carrera / semestre | `setMockAppData` | pull-to-refresh (perfil). |
| Materias | "Agregar materia simulada" / "Quitar" | `addMateria` / `removeMateria` (horario + boleta) | pull-to-refresh (horario y boleta). |
| Calificaciones | input por materia | `updateGrade` | toast de calificaciones el próximo refresh (si cambió vs. el snapshot guardado). |
| Adeudos | "Con adeudo" / "Sin adeudo" | `setAdeudosPresent` | alerta de adeudo el próximo refresh (transición limpio → con adeudo). |
| Reinscripción | presets ("En +30 min", "+1 día", "+1 semana", "+2 semanas", "Ayer", "Sin fecha") o fecha exacta | `setMockReinscripcionDate` | aviso "discovered" el próximo refresh si la fecha es futura y cambió; cruzar el momento con el Reloj mueve la tarjeta a "En curso"/"Pasó". |
| Avisos | "Agregar aviso de prueba" | `addAviso` | pull-to-refresh (lista de avisos). |

### Flujo del cambio (calificaciones, ejemplo)

1. Con **Sith = Mock**, en "Calificaciones" cambias una nota a `7.5`.
2. Haces **pull-to-refresh**.
3. `AuthProvider.refresh()` → `fetchAppData(credenciales, TestSithApi)` → el
   mock devuelve el alumno con la nota modificada.
4. `persistSession()` compara contra el snapshot anterior
   (`mergeGradeTracking`): detecta el cambio y guarda el nuevo.
5. El shell anuncia el evento: toast/cápsula de "calificaciones actualizadas"
   (y el home vuelve a ser Calificaciones si aplica).

Ninguna pantalla conoce la simulación: todo pasa por el mismo pipeline de
producción.

## El reloj simulado

- Solo funciona con la **API en Mock** (el `FakeClock` es la única fuente de
  tiempo mientras el modo Mock está activo: horario, cuenta regresiva de
  reinscripción, etc., todos lo usan vía `useClock()`).
- Botones rápidos: `-1 h`, `+15 min`, `+1 h`, `+1 día` (`clock.advance`),
  fecha/hora exacta (`clock.setDate`) y "Volver a la hora real"
  (`clock.setOffset(null)`).
- Con la API en **Real**, la sección solo muestra un aviso: no hay reloj
  simulado.

## Restaurar datos reales

El botón re-siembra el estado mock desde la caché (`DevTestEnvironment.reset`),
deshaciendo todas las ediciones de la sesión actual.

## Seguridad

El modo dev **no persiste contraseñas** ni toca el almacenamiento de sesión.
La simulación es solo de datos de alumno/avisos en memoria. La configuración
persistida se limita a `enabled` y a la duración de prueba de los toasts.

## Mapa de archivos

| Archivo | Rol |
| --- | --- |
| `src/lib/devtest/interfaces.ts` | `SithApi`, `Clock`, `DevTestEnvironmentInterface` |
| `src/lib/devtest/environment.ts` | Singleton con el estado mock y los métodos de mutación |
| `src/lib/devtest/provider.tsx` | `DevTestProvider` + hooks `useSithApi` / `useClock` / `useDevTestEnvironment` |
| `src/lib/devtest/real/` | `RealSithApi` y `SystemClock` (envuelven producción) |
| `src/lib/devtest/mock/` | `TestSithApi` y `FakeClock` |
| `src/features/devtools/DevPanel.tsx` | El panel (toggles arriba, edición debajo) |
| `src/features/devtools/components/` | Secciones de edición y pruebas |
| `src/features/devtools/dateTime.ts` | Helpers de fecha/hora compartidos (Reloj + Reinscripción) |
| `src/features/devtools/useDevConfig.ts` | Ciclo de vida abrir/cerrar del panel |
| `src/features/devtools/materiasAdapter.ts` | Convierte materias dev a `HorarioMateria`/`CalificacionMateria` |
| `src/features/auth/AuthProvider.tsx` | Consume `useSithApi`/`useClock` (pipeline real) |

## Referencias

- Resumen de implementación: `CHANGES_SUMMARY.md`
- Flujo de datos de la app: `docs/app-flow.md`