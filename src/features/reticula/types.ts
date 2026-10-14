import type { ReticulaMateria, SemestresReticula } from "@/lib/api/client";

export interface SemestreReticula {
  numero: number;
  materias: ReticulaMateria[];
  total: number;
  acreditadas: number;
  cursando: number;
  pendientes: number;
  estaCompleto: boolean;
}

export type FiltroReticula = "todas" | "pendientes" | "acreditadas" | "cursando";

export const ESTADO_MATERIA_LABELS: Record<number, string> = {
  0: "Falta cursar",
  1: "Inscripción normal",
  2: "Acreditada",
  3: "Acreditada sin calificación",
  4: "Complementarias aprobadas",
  5: "Repetición por cursar",
  6: "Inscripción en repetición",
  7: "Curso global",
  8: "A especial",
  9: "Inscripción en especial",
  10: "Especial reprobado",
  11: "Inscrito en curso normal",
  12: "Inscrito en curso de repetición",
  13: "Inscrito en curso de especial",
};

export const ESTADOS_CURSANDO = new Set<number>([1,5,6,7,8,9,11,12,13]);
export const ESTADOS_ACREDITADOS = new Set<number>([2,3,4]);
export function calcularProgresoSemestre(materias: ReticulaMateria[]) {
  const total = materias.length;
  const acreditadas = materias.filter((m) => ESTADOS_ACREDITADOS.has(m.codigoEstado)).length;
  const cursando = materias.filter((m) => ESTADOS_CURSANDO.has(m.codigoEstado)).length;
  const pendientes = total - acreditadas - cursando;
  return { total, acreditadas, cursando, pendientes, estaCompleto: acreditadas === total && total > 0 };
}

export function construirSemestres(
  semestres: SemestresReticula | undefined,
): SemestreReticula[] {
  if (!semestres) return [];
  return semestres.map((materias, indice) => {
    const ordenadas = [...materias].sort((a, b) => a.coordenadas.y - b.coordenadas.y);
    const progreso = calcularProgresoSemestre(ordenadas);
    return {
      numero: indice + 1,
      materias: ordenadas,
      ...progreso,
    };
  });
}

export function filtrarMaterias(
  materias: ReticulaMateria[],
  filtro: FiltroReticula,
): ReticulaMateria[] {
  switch (filtro) {
    case "pendientes":
      return materias.filter((m) => m.codigoEstado === 0);
    case "acreditadas":
      return materias.filter((m) => ESTADOS_ACREDITADOS.has(m.codigoEstado));
    case "cursando":
      return materias.filter((m) => ESTADOS_CURSANDO.has(m.codigoEstado));
    default:
      return materias;
  }
}

export function encontrarSemestreActual(
  semestres: SemestreReticula[],
  semestreAlumno: number,
): number {
  if (semestres.some((s) => s.numero === semestreAlumno)) return semestreAlumno;
  const conMaterias = semestres.filter((s) => s.total > 0);
  if (conMaterias.length === 0) return 1;
  const conMasCursando = conMaterias.reduce((max, s) =>
    s.cursando > max.cursando ? s : max,
  );
  return conMasCursando.numero;
}
export const ESTADO_MATERIA_VARIANT: Record<number, "success" | "warning" | "neutral" | "error"> = {
  0: "neutral",
  1: "neutral",
  2: "success",
  3: "success",
  4: "success",
  5: "warning",
  6: "warning",
  7: "neutral",
  8: "neutral",
  9: "neutral",
  10: "error",
  11: "neutral",
  12: "warning",
  13: "neutral",
};