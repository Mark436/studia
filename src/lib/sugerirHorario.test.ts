import { describe, expect, it } from "vitest";
import type { ReticulaMateria } from "@/lib/api/client";
import type {
  DiaHorario,
  PrehorarioGrupo,
  PrehorarioJson,
  PrehorarioMateria,
} from "@/lib/prehorarioTablas";
import {
  calcularSugerenciaHorario,
  huecosMinutos,
  parseBloque,
  seChochan,
  type HorarioSemanal,
} from "@/lib/sugerirHorario";

function reticula(clave: string, nombre = clave): ReticulaMateria {
  return {
    clave,
    nombre,
    coordenadas: { x: 1, y: 1 },
    codigoEstado: 0,
    estado: "Falta cursar" as ReticulaMateria["estado"],
    c: 0,
    g: 0,
    seriacion: [],
  };
}

function grupo(gpo: string, horario: Partial<Record<DiaHorario, string[]>>): PrehorarioGrupo {
  return {
    grupo: gpo,
    paquete: null,
    turno: null,
    especialidad: null,
    maestro: null,
    aula: null,
    horario: {
      lunes: [],
      martes: [],
      miercoles: [],
      jueves: [],
      viernes: [],
      ...horario,
    },
  };
}

function materiaPrehorario(
  clave: string,
  grupos: PrehorarioGrupo[],
): PrehorarioMateria {
  return {
    clave,
    nombre: clave,
    horas: { teoricas: null, practicas: null, semanales: null },
    creditos: null,
    grupos,
  };
}

function prehorario(materias: PrehorarioMateria[]): PrehorarioJson {
  return { S2: { materias } };
}

describe("parseBloque", () => {
  it("convierte «07:00-08:00» a minutos desde medianoche", () => {
    expect(parseBloque("07:00-08:00")).toEqual({ inicio: 420, fin: 480 });
    expect(parseBloque("13:30-15:00")).toEqual({ inicio: 810, fin: 900 });
  });

  it("acepta horas sin cero a la izquierda", () => {
    expect(parseBloque("7:00-8:00")).toEqual({ inicio: 420, fin: 480 });
  });

  it("devuelve null para cadenas inválidas", () => {
    expect(parseBloque("07-08")).toBeNull();
    expect(parseBloque("a:00-b:00")).toBeNull();
    expect(parseBloque("08:00-07:00")).toBeNull();
    expect(parseBloque("")).toBeNull();
  });
});

describe("seChochan", () => {
  it("detecta empalme en el mismo día", () => {
    const a: HorarioSemanal = { ...grupo("A", { lunes: ["08:00-09:00"] }).horario };
    const b: HorarioSemanal = { ...grupo("B", { lunes: ["08:30-09:30"] }).horario };
    expect(seChochan(a, b)).toBe(true);
  });

  it("no empalma si las clases son contiguas", () => {
    const a: HorarioSemanal = { ...grupo("A", { lunes: ["08:00-09:00"] }).horario };
    const b: HorarioSemanal = { ...grupo("B", { lunes: ["09:00-10:00"] }).horario };
    expect(seChochan(a, b)).toBe(false);
  });

  it("no empalma si están en días distintos", () => {
    const a: HorarioSemanal = { ...grupo("A", { lunes: ["08:00-09:00"] }).horario };
    const b: HorarioSemanal = { ...grupo("B", { martes: ["08:00-09:00"] }).horario };
    expect(seChochan(a, b)).toBe(false);
  });
});

describe("huecosMinutos", () => {
  it("suma los huecos entre bloques del mismo día", () => {
    const horario: HorarioSemanal = {
      ...grupo("X", {
        lunes: ["08:00-09:00", "09:30-10:30"],
        viernes: ["10:00-11:00", "13:00-14:00"],
      }).horario,
    };
    // lunes: 30 min · viernes: 120 min
    expect(huecosMinutos(horario)).toBe(150);
  });

  it("sin huecos si hay un solo bloque por día o bloques contiguos", () => {
    const horario: HorarioSemanal = {
      ...grupo("X", {
        lunes: ["08:00-09:00", "09:00-10:00"],
        martes: ["10:00-12:00"],
      }).horario,
    };
    expect(huecosMinutos(horario)).toBe(0);
  });

  it("ignora bloques inválidos", () => {
    const horario: HorarioSemanal = {
      ...grupo("X", { lunes: ["08:00-09:00", "no-va"] }).horario,
    };
    expect(huecosMinutos(horario)).toBe(0);
  });
});

describe("calcularSugerenciaHorario", () => {
  it("incluye materias con grupos que no chocan", () => {
    const result = calcularSugerenciaHorario(
      [reticula("A"), reticula("B")],
      prehorario([
        materiaPrehorario("A", [grupo("S2A", { lunes: ["08:00-09:00"] })]),
        materiaPrehorario("B", [grupo("S2B", { lunes: ["09:00-10:00"] })]),
      ]),
    );

    expect(result.materias.map(m => m.clave)).toEqual(["A", "B"]);
    expect(result.materias.map(m => m.grupo.grupo)).toEqual(["S2A", "S2B"]);
    expect(result.excluidas).toEqual([]);
    expect(result.huecosMinutos).toBe(0);
  });

  it("elige un grupo que no choca entre varias opciones", () => {
    const result = calcularSugerenciaHorario(
      [reticula("A"), reticula("B")],
      prehorario([
        materiaPrehorario("A", [grupo("S2A", { lunes: ["08:00-09:00"] })]),
        materiaPrehorario("B", [
          grupo("S2B1", { lunes: ["08:00-10:00"] }),
          grupo("S2B2", { lunes: ["10:00-11:00"] }),
        ]),
      ]),
    );

    expect(result.materias.find(m => m.clave === "B")?.grupo.grupo).toBe("S2B2");
    expect(result.excluidas).toEqual([]);
  });

  it("maximiza materias cubiertas aunque alguna se quede fuera", () => {
    const result = calcularSugerenciaHorario(
      [reticula("A"), reticula("B"), reticula("C")],
      prehorario([
        materiaPrehorario("A", [grupo("S2A", { lunes: ["08:00-09:00"] })]),
        materiaPrehorario("B", [grupo("S2B", { lunes: ["08:00-09:00"] })]),
        materiaPrehorario("C", [grupo("S2C", { lunes: ["09:00-10:00"] })]),
      ]),
    );

    expect(result.materias.map(m => m.clave).sort()).toEqual(["B", "C"]);
    expect(result.excluidas).toEqual([
      { clave: "A", nombre: "A", razon: "no-cabe-sin-choque" },
    ]);
  });

  it("marca como excluida la materia que no aparece en el prehorario", () => {
    const result = calcularSugerenciaHorario(
      [reticula("A"), reticula("B")],
      prehorario([materiaPrehorario("A", [grupo("S2A", { lunes: ["08:00-09:00"] })])]),
    );

    expect(result.materias.map(m => m.clave)).toEqual(["A"]);
    expect(result.excluidas).toEqual([
      { clave: "B", nombre: "B", razon: "sin-grupos-en-prehorario" },
    ]);
  });

  it("ignora grupos sin bloques (datos rotos) y excluye la materia", () => {
    const result = calcularSugerenciaHorario(
      [reticula("A")],
      prehorario([materiaPrehorario("A", [grupo("S2A", {})])]),
    );

    expect(result.materias).toEqual([]);
    expect(result.excluidas).toEqual([
      { clave: "A", nombre: "A", razon: "sin-grupos-en-prehorario" },
    ]);
  });

  it("entre horarios sin choque elige el de menos huecos (llega a llenar el hueco)", () => {
    const result = calcularSugerenciaHorario(
      [reticula("A"), reticula("B")],
      prehorario([
        materiaPrehorario("A", [
          grupo("S2A", { lunes: ["08:00-09:00", "10:00-11:00"] }),
        ]),
        materiaPrehorario("B", [
          grupo("S2B1", { lunes: ["09:00-10:00"] }), // llena el hueco de A: 0 min
          grupo("S2B2", { lunes: ["13:00-14:00"] }), // hueco 08→11 = 120 min, pero igual cabe
        ]),
      ]),
    );

    expect(result.materias.find(m => m.clave === "B")?.grupo.grupo).toBe("S2B1");
    expect(result.huecosMinutos).toBe(0);
  });

  it("sin materias devuelve una sugerencia vacía", () => {
    const result = calcularSugerenciaHorario([], prehorario([]));
    expect(result.materias).toEqual([]);
    expect(result.excluidas).toEqual([]);
    expect(result.huecosMinutos).toBe(0);
  });
});