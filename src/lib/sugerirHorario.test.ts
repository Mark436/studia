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
  coincideAproximadoClave,
  coincideAproximadoNombre,
  distanciaLevenshtein,
  gruposDeMateria,
  huecosMinutos,
  normalizarClave,
  normalizarNombreMateria,
  parseBloque,
  seChochan,
  similitudClave,
  similitudNombre,
  type HorarioSemanal,
} from "@/lib/sugerirHorario";

function reticula(clave: string, nombre = clave): ReticulaMateria {
  return {
    clave,
    nombre,
    coordenadas: { x: 1, y: 1 },
    codigoEstado: 0,
    estado: "Falta cursar" as ReticulaMateria["estado"],
    anteriores: [],
    siguientes: [],
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
  nombre = clave,
): PrehorarioMateria {
  return {
    clave,
    nombre,
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

describe("coincidencia aproximada de claves y nombres", () => {
  it("normaliza y calcula distancia y similitud de claves", () => {
    expect(normalizarClave("SCD-1016")).toBe("SCD1016");
    expect(normalizarClave("acf 0901")).toBe("ACF0901");
    expect(distanciaLevenshtein("ACF0901", "ACF0901")).toBe(0);
    expect(distanciaLevenshtein("ACF0901", "ACF0905")).toBe(1);

    expect(similitudClave("SCD-1016", "SCD1016")).toBe(1.0);
    expect(coincideAproximadoClave("SCD-1016", "SCD1016")).toBe(true);
    expect(coincideAproximadoClave("SCD1016", "SC1016")).toBe(true);
    expect(coincideAproximadoClave("ACF0901", "AED1285")).toBe(false);
  });

  it("normaliza nombres removiendo acentos, stopwords, anotaciones y abreviaturas", () => {
    expect(normalizarNombreMateria("CÁLCULO DIFERENCIAL ( R )")).toBe("CALCULO DIFERENCIAL");
    expect(normalizarNombreMateria("Estructuras de Datos")).toBe("ESTRUCTURA DATO");
    expect(normalizarNombreMateria("Lenguajes y Autómatas I")).toBe("LENGUAJE AUTOMATA 1");
    expect(normalizarNombreMateria("DESARROLLO DE SW DISTRIBUIDO II")).toBe("DESARROLLO SOFTWARE DISTRIBUIDO 2");
  });

  it("calcula similitud de nombres y detecta matches aproximados válidos", () => {
    expect(similitudNombre("Cálculo Diferencial", "CALCULO DIFERENCIAL ( R )")).toBe(1.0);
    expect(coincideAproximadoNombre("Cálculo Diferencial", "CALCULO DIFERENCIAL ( R )")).toBe(true);
    expect(coincideAproximadoNombre("Estructura de Datos", "ESTRUCTURAS DE DATOS")).toBe(true);
    expect(coincideAproximadoNombre("Lenguajes y Autómatas I", "LENGUAJES Y AUTOMATAS 1")).toBe(true);
    expect(coincideAproximadoNombre("Desarrollo de Software Distribuido II", "DESARROLLO DE SW DISTRIBUIDO II")).toBe(true);
    expect(coincideAproximadoNombre("Taller de Base de Datos", "TALLER DE BASES DE DATOS")).toBe(true);

    // Nombres distintos no deben coincidir
    expect(coincideAproximadoNombre("Cálculo Diferencial", "CALCULO INTEGRAL")).toBe(false);
    expect(coincideAproximadoNombre("Física General", "QUIMICA GENERAL")).toBe(false);
  });
});

describe("gruposDeMateria - búsqueda exacta y aproximada", () => {
  it("encuentra grupos por coincidencia exacta de clave primero", () => {
    const json = prehorario([
      materiaPrehorario("ACF0901", [grupo("S2A", { lunes: ["07:00-08:00"] })], "CALCULO DIFERENCIAL"),
    ]);

    const grupos = gruposDeMateria(
      { clave: "ACF0901", nombre: "Cálculo Diferencial" },
      json,
    );
    expect(grupos.map(g => g.grupo)).toEqual(["S2A"]);
  });

  it("si no encuentra por clave exacta, busca por match aproximado de nombre Y clave (ambos)", () => {
    const json = prehorario([
      materiaPrehorario("SCD1016", [grupo("S7B", { lunes: ["07:00-08:00"] })], "LENGUAJES Y AUTOMATAS I"),
      materiaPrehorario("DSF2405", [grupo("S9B", { lunes: ["16:00-17:00"] })], "DESARROLLO DE SW DISTRIBUIDO II"),
      materiaPrehorario("ACF0905", [grupo("E3A", { lunes: ["13:00-14:00"] })], "ECUACIONES DIFERENCIALES ( R )"),
    ]);

    // Caso 1: Clave con guión "SCD-1016" vs "SCD1016" y nombre "Lenguajes y Autómatas 1" vs "LENGUAJES Y AUTOMATAS I"
    const gruposLenguajes = gruposDeMateria(
      { clave: "SCD-1016", nombre: "Lenguajes y Autómatas 1" },
      json,
    );
    expect(gruposLenguajes.map(g => g.grupo)).toEqual(["S7B"]);

    // Caso 2: Nombre con SW vs SOFTWARE y clave con guión
    const gruposSW = gruposDeMateria(
      { clave: "DSF-2405", nombre: "Desarrollo de Software Distribuido II" },
      json,
    );
    expect(gruposSW.map(g => g.grupo)).toEqual(["S9B"]);

    // Caso 3: Nombre con anotación ( R ) y clave con guión
    const gruposEcuaciones = gruposDeMateria(
      { clave: "ACF-0905", nombre: "Ecuaciones Diferenciales" },
      json,
    );
    expect(gruposEcuaciones.map(g => g.grupo)).toEqual(["E3A"]);
  });

  it("NO encuentra si coincide aproximadamente la clave pero NO el nombre", () => {
    const json = prehorario([
      materiaPrehorario("ACF0903", [grupo("O3A", { lunes: ["13:00-14:00"] })], "CALCULO VECTORIAL"),
    ]);

    // "ACF-0905" vs "ACF0903" tiene clave cercana (distancia 1), pero el nombre es Ecuaciones Diferenciales vs Cálculo Vectorial
    const grupos = gruposDeMateria(
      { clave: "ACF-0905", nombre: "Ecuaciones Diferenciales" },
      json,
    );
    expect(grupos).toEqual([]);
  });

  it("NO encuentra si coincide aproximadamente el nombre pero NO la clave", () => {
    const json = prehorario([
      materiaPrehorario("ACF0901", [grupo("S1A", { lunes: ["07:00-08:00"] })], "CALCULO DIFERENCIAL"),
    ]);

    // Nombre coincide, pero clave es completamente distinta (ej. de otro plan o universidad)
    const grupos = gruposDeMateria(
      { clave: "MAT101", nombre: "Cálculo Diferencial" },
      json,
    );
    expect(grupos).toEqual([]);
  });

  it("calcularSugerenciaHorario resuelve horarios con materias emparejadas por búsqueda aproximada", () => {
    const reticulaMaterias = [
      reticula("SCD-1016", "Lenguajes y Autómatas 1"),
      reticula("DSF-2405", "Desarrollo de Software Distribuido II"),
    ];

    const json = prehorario([
      materiaPrehorario("SCD1016", [grupo("S7B", { lunes: ["07:00-08:00"] })], "LENGUAJES Y AUTOMATAS I"),
      materiaPrehorario("DSF2405", [grupo("S9B", { lunes: ["08:00-09:00"] })], "DESARROLLO DE SW DISTRIBUIDO II"),
    ]);

    const result = calcularSugerenciaHorario(reticulaMaterias, json);
    expect(result.materias.map(m => m.clave)).toEqual(["SCD-1016", "DSF-2405"]);
    expect(result.materias.map(m => m.grupo.grupo)).toEqual(["S7B", "S9B"]);
    expect(result.excluidas).toEqual([]);
  });
});