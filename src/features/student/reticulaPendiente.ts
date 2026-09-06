import type { ReticulaMateria } from "@/lib/api/client";

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