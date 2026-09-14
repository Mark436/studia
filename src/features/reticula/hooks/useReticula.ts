import { useMemo, useState } from "react";
import type { ReticulaMateria, SemestresReticula } from "@/lib/api/client";
import type { FiltroReticula } from "../types";
import {
  construirSemestres,
  encontrarSemestreActual,
  filtrarMaterias,
} from "../types";

export function useReticula(
  semestresReticula: SemestresReticula | undefined,
  semestreAlumno: number,
) {
  const [filtro, setFiltro] = useState<FiltroReticula>("todas");

  const semestres = useMemo(
    () => construirSemestres(semestresReticula),
    [semestresReticula],
  );

  const semestreActual = useMemo(
    () => encontrarSemestreActual(semestres, semestreAlumno),
    [semestres, semestreAlumno],
  );

  const obtenerMateriasFiltradas = (
    numero: number,
  ): ReticulaMateria[] => {
    const semestre = semestres.find((s) => s.numero === numero);
    return semestre ? filtrarMaterias(semestre.materias, filtro) : [];
  };

  return {
    semestres,
    semestreActual,
    filtro,
    setFiltro,
    obtenerMateriasFiltradas,
  };
}