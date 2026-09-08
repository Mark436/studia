import type {
  Coordenadas,
  ReticulaMateria,
} from "@/lib/api/client";

export const ESTADOS_ACREDITADOS = new Set<number>([
  2, // ACREDITADA
  3, // ACREDITADA_SIN_CALIFICACION
  4, // COMPLEMENTARIAS_APROBADAS
]);

export function getMateriasPendientes(
  reticula: ReticulaMateria[],
): ReticulaMateria[] {
  return reticula.filter(
    (materia) => !ESTADOS_ACREDITADOS.has(materia.codigoEstado),
  );
}

function claveCoordenada({ x, y }: Coordenadas): string {
  return `${x}:${y}`;
}

/**
 * Materias pendientes que "tocan ya": sus prerrequisitos (seriación) están
 * satisfechos con la retícula actual. No corta por semestre: sirve igual para
 * un alumno regular y para uno con materias adelantadas.
 *
 * Seriación: cada grupo "o" exige que al menos UNA de sus coordenadas
 * corresponda a una materia ya acreditada (AND entre grupos, OR dentro de
 * cada grupo). Seriación vacía = disponible.
 */
export function getMateriasDisponibles(
  reticula: ReticulaMateria[],
): ReticulaMateria[] {
  const porCoordenada = new Map<string, ReticulaMateria>();
  for (const materia of reticula) {
    porCoordenada.set(claveCoordenada(materia.coordenadas), materia);
  }

  const pendientes = new Set(
    getMateriasPendientes(reticula).map((materia) => materia.clave),
  );

  return reticula.filter(
    (materia) =>
      pendientes.has(materia.clave) &&
      materia.seriacion.every((grupo) =>
        grupo.some((coordenada) => {
          const precedente = porCoordenada.get(claveCoordenada(coordenada));
          return (
            precedente !== undefined &&
            ESTADOS_ACREDITADOS.has(precedente.codigoEstado)
          );
        }),
      ),
  );
}