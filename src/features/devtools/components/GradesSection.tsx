import { useDevTestEnvironment } from "@/lib/devtest/provider";

export function GradesSection() {
  const env = useDevTestEnvironment();
  const materias = env.getMockAppData()?.alumno.boleta.materias ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Calificaciones</h4>

      {materias.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {materias.map((materia) => (
            <li
              key={materia.clave}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-on-surface">
                  {materia.nombre}
                </p>
              </div>
              <label className="sr-only" htmlFor={`grade-${materia.clave}`}>
                Calificación simulada de {materia.nombre}
              </label>
              <input
                id={`grade-${materia.clave}`}
                value={materia.calificacion}
                onChange={(event) =>
                  env.updateGrade(materia.clave, event.target.value)
                }
                inputMode="numeric"
                className="h-9 w-16 rounded-lg border border-outline bg-surface px-2 text-center text-sm tabular-nums text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No hay materias con calificación.
        </p>
      )}
    </section>
  );
}