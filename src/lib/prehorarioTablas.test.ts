import { describe, expect, it } from "vitest";
import type { PaginaRenglones } from "./pdfTexto";
import {
  procesarPrehorarioTexto,
  type PrehorarioJson,
} from "./prehorarioTablas";

function pagina(renglones: Array<{ y: number; celdas: Array<{ x: number; texto: string }> }>): PaginaRenglones[] {
  return [
    {
      numero: 1,
      renglones: renglones
        .map(renglon => ({ y: renglon.y, celdas: renglon.celdas }))
        .sort((a, b) => b.y - a.y),
    },
  ];
}

const clave = (texto: string) => ({ x: 56, texto });
const gpo = (texto: string) => ({ x: 100, texto });
const materia = (texto: string) => ({ x: 124, texto });
const num = (x: number, texto: string) => ({ x, texto });
const maestro = (texto: string) => ({ x: 367, texto });
const aula = (texto: string) => ({ x: 525, texto });
const dia = (x: number, texto: string) => ({ x, texto });

describe("procesarPrehorarioTexto", () => {
  it("agrupa secciones, filas con clave retrasada y continuaciones de maestro", () => {
    const paginas = pagina([
      // Cabecera de tabla + PAQUETE + TURNO (mismo cluster por cercanía).
      { y: 62, celdas: [{ x: 62, texto: "Clave" }, { x: 100, texto: "Gpo" }, { x: 124, texto: "Materia" }, { x: 367, texto: "MAESTRO" }, { x: 550, texto: "Lun" }, { x: 580, texto: "Mar" }, { x: 611, texto: "Mie" }] },
      // La clave va debajo de sus datos (patrón actividad/servicio social).
      { y: 45, celdas: [gpo("S5A"), materia("CALCULO DIFERENCIAL"), num(320, "3"), num(328, "2"), num(338, "5"), num(354, "5"), maestro("FERRER MORENO LAZARO"), aula("A81"), dia(550, "7-8"), dia(580, "9-11"), dia(611, "9-11")] },
      { y: 44, celdas: [clave("ACF0901")] },
      // Fila normal, con wrap de maestro que queda a más de 6 pt (continuación).
      { y: 25, celdas: [gpo("S5B"), num(320, "2"), num(328, "3"), num(338, "5"), num(354, "5"), aula("A82"), dia(550, "10-11")] },
      { y: 24, celdas: [clave("AED1285"), materia("FUNDAMENTOS DE PROGRAMACION")] },
      { y: 17, celdas: [maestro("MADRID MARTINEZ JOSE")] },
      { y: 10, celdas: [gpo("S5B"), materia("TUTORIAS I"), num(320, "0"), num(328, "2"), num(338, "1"), num(354, "2"), maestro("MOCTEZUMA ENRIQUEZ"), aula("A88"), dia(550, "12-14")] },
      { y: 9, celdas: [clave("TUS2010")] },
    ]);

    const json: PrehorarioJson = procesarPrehorarioTexto(paginas);

    expect(Object.keys(json)).toEqual(["S5"]);
    expect(json.S5.materias.map(m => m.clave)).toEqual([
      "ACF0901",
      "AED1285",
      "TUS2010",
    ]);

    const calculo = json.S5.materias[0];
    expect(calculo.nombre).toBe("CALCULO DIFERENCIAL");
    expect(calculo.horas).toEqual({ teoricas: 3, practicas: 2, semanales: 5 });
    expect(calculo.creditos).toBe(5);
    expect(calculo.grupos[0]).toMatchObject({
      grupo: "S5A",
      paquete: null,
      turno: null,
      maestro: "FERRER MORENO LAZARO",
      aula: "A81",
    });
    expect(calculo.grupos[0].horario).toEqual({
      lunes: ["07:00-08:00"],
      martes: ["09:00-11:00"],
      miercoles: ["09:00-11:00"],
      jueves: [],
      viernes: [],
    });

    const fundamentos = json.S5.materias[1];
    expect(fundamentos.grupos[0]).toMatchObject({
      grupo: "S5B",
      maestro: "MADRID MARTINEZ JOSE",
      aula: "A82",
    });
    expect(fundamentos.grupos[0].horario.lunes).toEqual(["10:00-11:00"]);
  });

  it("asigna paquete, turno y especialidad a la sección siguiente", () => {
    const paginas = pagina([
      { y: 80, celdas: [clave("SCD1016"), gpo("S7B"), materia("LENGUAJES Y AUTOMATAS I"), num(320, "2"), num(328, "3"), num(338, "5"), num(354, "5"), maestro("GERMAN GANDARILLA GELACIO"), aula("L5"), dia(550, "7-8")] },
      { y: 50, celdas: [{ x: 124, texto: "ESPECIALIDAD DESARROLLO DE SW DISTRIBUIDO TURNO VESPERTINO" }] },
      { y: 49, celdas: [{ x: 52, texto: "PAQUETE 9/2" }] },
      { y: 30, celdas: [clave("DSF2405"), gpo("S9B"), materia("DESARROLLO DE SW DISTRIBUIDO II"), num(320, "3"), num(328, "2"), num(338, "5"), num(354, "5"), maestro("VELAZQUEZ MENDOZA MARIA"), aula("L5"), dia(550, "16-17")] },
    ]);

    const json = procesarPrehorarioTexto(paginas);

    expect(json.S7.materias[0].grupos[0].paquete).toBeNull();
    const grupo9 = json.S9.materias[0].grupos[0];
    expect(grupo9.grupo).toBe("S9B");
    expect(grupo9.paquete).toBe("9/2");
    expect(grupo9.turno).toBe("vespertino");
    expect(grupo9.especialidad).toBe("DESARROLLO DE SW DISTRIBUIDO");
  });
});