# Sistema de Testing para Modo Dev — Simulación de Sesión Completa

<contexto>
Actualmente el proyecto tiene testing parcial. Quiero evolucionarlo a un sistema
que simule una **sesión completa y aislada** de la aplicación en modo Dev,
usando las mismas interfaces que producción, sin tocar el comportamiento del
modo normal.
</contexto>

<objetivo>
Diseñar e implementar una capa de Dev/Test que permita simular de forma
determinista y con estado persistente durante la sesión:

1. Peticiones al Sith API Client.
2. Peticiones a la API de documentos.
3. Eventos (nueva calificación, cambio de calificación, cambio de fecha,
   avisos nuevos/modificados/eliminados, y otros eventos equivalentes a
   resultados de una consulta a API).
4. Paso del tiempo, vía el sistema de Fake Clock ya existente.
   </objetivo>

<restricciones_criticas>

- El modo normal (APIs reales, reloj real, clientes actuales) debe permanecer
  **exactamente igual**. Cero impacto en producción.
- Dev/Test solo existe dentro del modo Dev y se destruye por completo al
  cerrarlo — ningún estado global de testing debe sobrevivir ni filtrarse al
  modo normal.
- La aplicación (lógica de negocio) **no debe saber** si habla con la
  implementación real o la de test — misma interfaz, implementación
  intercambiable.
- Prohibido llenar el código de `if (isDev)`, `if (isTest)`, `if (useMock)`
  dispersos. Usar un mecanismo de inyección de dependencias / provider /
  factory con un punto central de selección.
- No todo debe mockearse automáticamente: debe existir un control explícito
  por funcionalidad para usar REAL o MOCK dentro de Dev/Test (ej. probar el
  pipe real de documentos mientras el resto sigue mockeado).
- La API de documentos debe seguir siendo una abstracción interna simple
  (Real/Mock) — **no** convertirla en paquete independiente.
- El Fake Clock debe ser la **única fuente de tiempo** cuando Dev/Test está
  activo (nada debe seguir leyendo `Date()`/reloj del sistema en paralelo).
- El estado mock no son valores estáticos: debe soportar mutaciones
  (`addGrade()`, etc.) que después se reflejen en las consultas
  (`getGrades()`, etc.), permitiendo transiciones reales Estado A → evento →
  Estado B.
  </restricciones_criticas>

<arquitectura_esperada>
Interfaces con doble implementación, seleccionadas por un controlador central
(nombre sugerido: `DevTestEnvironment`, pero evalúa cuál encaja mejor con el
proyecto):

- `SithApi` → `RealSithApi` | `TestSithApi`
- `DocumentsApi` → `RealDocumentsApi` | `TestDocumentsApi`
- `Clock` → `SystemClock` | `FakeClock`

El controlador central coordina: estado mock, fake clock, ambas test APIs,
disparo de eventos simulados, reset del entorno, activación/desactivación, y
la selección real/mock por funcionalidad cuando aplica.

Los eventos disparados desde Dev/Test deben fluir por los **flujos normales**
de la aplicación (no atajos de testing):

```
Test Controller → Mock API → Aplicación → Flujo normal de actualización
```

</arquitectura_esperada>

<criterios_de_aceptacion>
El sistema debe soportar estos escenarios de punta a punta, de forma
reproducible/determinista:

1. **Nueva calificación**: agregar calificación → consultar Sith API → la
   app detecta el cambio → ejecuta flujo de actualización → estado/UI
   reflejan el cambio.
2. **Cambio de calificación**: modificar valor existente → consultar API →
   la app detecta la diferencia → procesa la actualización.
3. **Nuevo aviso + tiempo**: avanzar el Fake Clock → crear aviso en Test API
   → consultar API → la app detecta el nuevo aviso.
4. **Cambio de fecha**: modificar fecha en el mock → consultar API → la app
   detecta y actualiza el estado correspondiente.
5. **Evento dependiente del tiempo**: Fake Clock en T0 → avanzar a T1 →
   evento ocurre en T1 → mock refleja el nuevo estado → la app lo consulta y
   procesa.
6. **Documentos (mock)**: modificar estado en Documents Test API → ejecutar
   flujo normal → verificar respuesta de la app.
7. **Documentos (real, coexistiendo con lo anterior)**: forzar la
   implementación real para ese flujo específico → ejecutar pipe real →
   observar resultado real, sin que el resto del entorno Dev/Test deje de
   estar mockeado.
   </criterios_de_aceptacion>

<proceso_requerido>
No implementes directamente. Sigue este orden:

**Paso 1 — Análisis de la arquitectura actual.** Investiga y reporta:

- Cómo está implementado hoy el Sith API Client.
- Cómo se hacen hoy las consultas de documentos.
- Dónde se usa directamente la hora/fecha del sistema.
- Cómo funciona el Fake Clock actual.
- Cómo se generan/procesan los eventos actuales.
- Qué partes dependen de implementaciones concretas (no de interfaces).
- Qué componentes necesitan una abstracción nueva para intercambiar
  Real/Mock.
- Cómo aislar el estado de Dev/Test del estado real sin arriesgar fugas.

**Paso 2 — Propuesta de arquitectura.** Antes de tocar código, propón el
diseño concreto (interfaces, dónde vive el controlador central, cómo se
inyectan las implementaciones, cómo se resetea el entorno). Señala cualquier
punto de integración riesgoso o conflicto con el diseño actual.

**Paso 3 — Implementación.** Solo después de validar el paso 2, implementa
siguiendo la arquitectura propuesta, manteniendo intacto el comportamiento
del modo normal y cubriendo los 7 criterios de aceptación.
</proceso_requerido>

<prioridades>
Si hay tensión entre objetivos, prioriza en este orden:
1. No romper el modo normal.
2. Aislamiento completo del estado de testing.
3. Reutilizar las interfaces reales (no duplicar lógica de negocio para test).
4. Simulación de transiciones de estado, no respuestas estáticas.
5. Fake Clock como única fuente de tiempo en Dev/Test.
6. Selección explícita Real/Mock por funcionalidad.
7. Documents API simple e interna, sin paquete nuevo.
8. Reproducibilidad y determinismo.
</prioridades>
