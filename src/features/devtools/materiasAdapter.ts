import type { CalificacionMateria, HorarioDia, HorarioMateria } from "sith-api-client";
import type { DevMateria } from "./types";

const WEEKDAY_FIELD_BY_DAY: Partial<Record<number, keyof HorarioDia>> = {
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
};

function buildDias(materia: DevMateria): HorarioDia {
  const salon = materia.salon.trim();
  const slot = `${materia.inicio}-${materia.fin}${salon !== "" ? ` ${salon}` : ""}`;
  const dias: HorarioDia = {};

  for (const day of materia.dias) {
    const field = WEEKDAY_FIELD_BY_DAY[day];
    if (field) dias[field] = slot;
  }

  return dias;
}

export function toHorarioMateria(materia: DevMateria): HorarioMateria {
  return {
    clave: materia.clave,
    creditos: undefined,
    grupo: "*",
    docente: materia.docente,
    dias: buildDias(materia),
  };
}

export function toCalificacionMateria(materia: DevMateria): CalificacionMateria {
  return {
    clave: materia.clave,
    nombre: materia.nombre,
    calificacion: materia.calificacion.trim(),
    claveOportunidad: "",
    oportunidad: "",
    creditos: 0,
  };
}