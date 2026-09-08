import { describe, expect, it } from "vitest";
import type { ReticulaMateria } from "@/lib/api/client";
import {
  getMateriasDisponibles,
  getMateriasPendientes,
} from "@/features/student/reticulaPendiente";

function materia(
  clave: string,
  x: number,
  codigoEstado: number,
  seriacion: ReticulaMateria["seriacion"] = [],
): ReticulaMateria {
  return {
    clave,
    nombre: clave,
    coordenadas: { x, y: 1 },
    codigoEstado,
    estado: String(codigoEstado) as ReticulaMateria["estado"],
    c: codigoEstado,
    g: 0,
    seriacion,
  };
}

describe("getMateriasPendientes", () => {
  it("filtra por estados acreditados (2, 3, 4)", () => {
    const reticula = [
      materia("A", 1, 2),
      materia("B", 1, 3),
      materia("C", 2, 4),
      materia("D", 2, 0),
      materia("E", 3, 11),
    ];
    expect(getMateriasPendientes(reticula).map(m => m.clave)).toEqual([
      "D",
      "E",
    ]);
  });
});

describe("getMateriasDisponibles", () => {
  it("libera materias sin seriación", () => {
    const reticula = [materia("A", 1, 2), materia("B", 2, 0)];
    expect(getMateriasDisponibles(reticula).map(m => m.clave)).toEqual(["B"]);
  });

  it("desbloquea una materia cuando su prerrequisito ya está acreditado", () => {
    const reticula = [
      materia("INV1", 3, 2),
      materia("INV2", 4, 0, [[{ x: 3, y: 1 }]]),
    ];
    expect(getMateriasDisponibles(reticula).map(m => m.clave)).toEqual([
      "INV2",
    ]);
  });

  it("mantiene bloqueada la materia cuyo prerrequisito aún no se acredita", () => {
    const reticula = [
      materia("INV1", 3, 0),
      materia("INV2", 4, 0, [[{ x: 3, y: 1 }]]),
    ];
    expect(getMateriasDisponibles(reticula).map(m => m.clave)).toEqual([
      "INV1",
    ]);
  });

  it("respeta el OR dentro de cada grupo «o» de seriación", () => {
    const reticula = [
      materia("OPC1", 4, 2),
      materia("OPC2", 5, 0, [[{ x: 1, y: 1 }]]),
      materia("RESULTADO", 6, 0, [[{ x: 4, y: 1 }, { x: 5, y: 1 }]]),
    ];
    // OPC2 está bloqueada por su propio prerrequisito (no por el grupo «o»).
    expect(getMateriasDisponibles(reticula).map(m => m.clave)).toEqual([
      "RESULTADO",
    ]);
  });

  it("respeta el AND entre grupos de seriación", () => {
    const reticula = [
      materia("PRE1", 4, 2),
      materia("PRE2", 5, 0),
      materia("RESULTADO", 6, 0, [
        [{ x: 4, y: 1 }],
        [{ x: 5, y: 1 }],
      ]),
    ];
    expect(getMateriasDisponibles(reticula).map(m => m.clave)).toEqual([
      "PRE2",
    ]);
  });

  it("no da por satisfecha una seriación que apunta a una coordenada sin materia", () => {
    const reticula = [
      materia("RESULTADO", 6, 0, [[{ x: 1, y: 9 }]]),
    ];
    expect(getMateriasDisponibles(reticula).map(m => m.clave)).toEqual([]);
  });

  it("funciona con materias adelantadas: no corta por el semestre en curso", () => {
    // Alumno con 1er semestre atrasado (sem 1 pendiente) pero INV1 acreditada:
    // INV2 (sem 4) está disponible aunque el resto del semestre 1 no. Las de
    // sem 1 sin seriación también están disponibles; el punto es que INV2 NO
    // queda bloqueada por "cortar" en el semestre del alumno.
    const reticula = [
      materia("SEM1_1", 1, 0),
      materia("SEM1_2", 1, 0),
      materia("INV1", 3, 2),
      materia("INV2", 4, 0, [[{ x: 3, y: 1 }]]),
    ];
    const disponibles = getMateriasDisponibles(reticula);
    expect(disponibles.map(m => m.clave)).toEqual([
      "SEM1_1",
      "SEM1_2",
      "INV2",
    ]);
  });
});