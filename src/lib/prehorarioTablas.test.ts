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

  it("detecta las columnas de un prehorario de Semiconductores (grupos O/E y geometría corrida)", () => {
    const paginas = pagina([
      // Cabecera con «HRS» y «SEM» en renglones apilados (misma geometría que el PDF real).
      { y: 292, celdas: [{ x: 361.6, texto: "HRS" }] },
      { y: 287, celdas: [{ x: 67.1, texto: "Clave" }, { x: 110.7, texto: "Gpo" }, { x: 135.1, texto: "Materia" }, { x: 327.1, texto: "T" }, { x: 336.6, texto: "P" }, { x: 348.3, texto: "C" }, { x: 378.9, texto: "MAESTRO" }, { x: 540.0, texto: "AULA" }, { x: 571.4, texto: "Lun" }, { x: 600.7, texto: "Mar" }, { x: 632.1, texto: "Mie" }, { x: 663.3, texto: "Jue" }, { x: 694.7, texto: "Vie" }] },
      { y: 284, celdas: [{ x: 361.4, texto: "SEM" }] },
      { y: 270, celdas: [{ x: 61.8, texto: "ACF0905" }, { x: 111.0, texto: "E3A" }, { x: 135.1, texto: "ECUACIONES DIFERENCIALES ( R )" }, { x: 327.6, texto: "3" }, { x: 337.4, texto: "2" }, { x: 349.3, texto: "5" }, { x: 365.8, texto: "5" }, { x: 378.9, texto: "SILVA MOLINA ROSELA YESENIA GPE." }, { x: 542.5, texto: "A5-7" }, { x: 571.4, texto: "13-14" }] },
      { y: 257, celdas: [{ x: 61.8, texto: "ACF0901" }, { x: 111.0, texto: "O1A" }, { x: 135.1, texto: "CALCULO DIFERENCIAL ( R )" }, { x: 327.6, texto: "4" }, { x: 337.4, texto: "2" }, { x: 349.3, texto: "6" }, { x: 365.8, texto: "6" }, { x: 378.9, texto: "LOPEZ ESTRADA RENE" }, { x: 542.5, texto: "A5-7" }, { x: 571.4, texto: "13-14" }] },
      { y: 244, celdas: [{ x: 61.8, texto: "ACF0903" }, { x: 111.0, texto: "O3A" }, { x: 135.1, texto: "CALCULO VECTORIAL ( R )" }, { x: 327.6, texto: "4" }, { x: 337.4, texto: "2" }, { x: 349.3, texto: "6" }, { x: 365.8, texto: "6" }, { x: 378.9, texto: "JUAREZ LOPEZ JOSE" }, { x: 542.5, texto: "A5-7" }, { x: 571.4, texto: "13-14" }] },
      { y: 231, celdas: [{ x: 61.8, texto: "ACF0905" }, { x: 111.0, texto: "O5A" }, { x: 135.1, texto: "ESTADISTICA PARA INGENIERIA ( R )" }, { x: 327.6, texto: "3" }, { x: 337.4, texto: "2" }, { x: 349.3, texto: "5" }, { x: 365.8, texto: "5" }, { x: 378.9, texto: "ROBLES JIMENEZ ADRIANA" }, { x: 542.5, texto: "A5-7" }, { x: 571.4, texto: "13-14" }] },
    ]);

    const json = procesarPrehorarioTexto(paginas);

    // Mismo número de materia (ACF0905) en S3 y S5: cada una es una materia.
    expect(Object.keys(json)).toEqual(["S3", "S1", "S5"]);
    expect(json.S3.materias.map(m => m.clave)).toEqual(["ACF0905", "ACF0903"]);

    const ecuaciones = json.S3.materias[0];
    expect(ecuaciones.nombre).toBe("ECUACIONES DIFERENCIALES ( R )");
    expect(ecuaciones.horas).toEqual({ teoricas: 3, practicas: 2, semanales: 5 });
    expect(ecuaciones.creditos).toBe(5);
    expect(ecuaciones.grupos.map(g => g.grupo)).toEqual(["E3A"]);
    expect(ecuaciones.grupos[0]).toMatchObject({ maestro: "SILVA MOLINA ROSELA YESENIA GPE.", aula: "A5-7" });
    expect(ecuaciones.grupos[0].horario.lunes).toEqual(["13:00-14:00"]);

    const calculo = json.S1.materias[0];
    expect(calculo.grupos.map(g => g.grupo)).toEqual(["O1A"]);
    expect(calculo.horas.semanales).toBe(6);

    expect(json.S3.materias[1].grupos.map(g => g.grupo)).toEqual(["O3A"]);
    expect(json.S5.materias[0].grupos.map(g => g.grupo)).toEqual(["O5A"]);
  });

  it("detecta las columnas de un prehorario de Mecatrónica (grupos T e «HRS SEM» en línea)", () => {
    const paginas = pagina([
      { y: 50, celdas: [{ x: 70.6, texto: "Clave" }, { x: 112.2, texto: "Gpo" }, { x: 131.2, texto: "Materia" }, { x: 306.1, texto: "T" }, { x: 315.6, texto: "P" }, { x: 328.6, texto: "C" }, { x: 345.3, texto: "HRS SEM" }, { x: 378.5, texto: "MAESTRO" }, { x: 572.0, texto: "AULA" }, { x: 605.6, texto: "Lun" }, { x: 630.9, texto: "Mar" }, { x: 656.4, texto: "Mie" }, { x: 681.3, texto: "Jue" }, { x: 707.3, texto: "Vie" }] },
      { y: 30, celdas: [{ x: 64.0, texto: "AEM1056" }, { x: 112.6, texto: "T1B" }, { x: 131.2, texto: "CALCULO DIFERENCIAL" }, { x: 306.6, texto: "3" }, { x: 316.4, texto: "2" }, { x: 329.4, texto: "5" }, { x: 356.4, texto: "5" }, { x: 378.5, texto: "HERNANDEZ GARCIA LETICIA" }, { x: 575.6, texto: "T1" }, { x: 605.6, texto: "9-11" }] },
      { y: 17, celdas: [{ x: 64.0, texto: "ACM1612" }, { x: 112.6, texto: "T1C" }, { x: 131.2, texto: "FISICA GENERAL" }, { x: 306.6, texto: "2" }, { x: 316.4, texto: "3" }, { x: 329.4, texto: "5" }, { x: 356.4, texto: "5" }, { x: 378.5, texto: "ZAVALA GARCIA LUIS" }, { x: 575.6, texto: "L2" }, { x: 605.6, texto: "12-14" }] },
    ]);

    const json = procesarPrehorarioTexto(paginas);

    expect(Object.keys(json)).toEqual(["S1"]);
    expect(json.S1.materias.map(m => m.clave)).toEqual(["AEM1056", "ACM1612"]);
    expect(json.S1.materias[0].grupos.map(g => g.grupo)).toEqual(["T1B"]);
    expect(json.S1.materias[0].horas).toEqual({ teoricas: 3, practicas: 2, semanales: 5 });
    expect(json.S1.materias[0].grupos[0].horario.lunes).toEqual(["09:00-11:00"]);
    expect(json.S1.materias[1].grupos.map(g => g.grupo)).toEqual(["T1C"]);
  });

  it("detecta la columna semanal fragmentada «HR»+«S» (IGE) y valida geométricamente los nombres", () => {
    const paginas = pagina([
      { y: 195, celdas: [{ x: 312.4, texto: "HR" }] },
      { y: 189, celdas: [{ x: 69.2, texto: "Clave" }, { x: 121.2, texto: "Gpo" }, { x: 150.6, texto: "Materia" }, { x: 275.8, texto: "T" }, { x: 288.5, texto: "P" }, { x: 301.3, texto: "C" }, { x: 325.6, texto: "MAESTRO" }, { x: 493.3, texto: "AULA" }, { x: 527.1, texto: "Lun" }, { x: 558.0, texto: "Mar" }, { x: 592.2, texto: "Mie" }, { x: 623.3, texto: "Jue" }, { x: 653.0, texto: "Vie" }] },
      { y: 186, celdas: [{ x: 315.2, texto: "S" }] },
      { y: 170, celdas: [{ x: 65.7, texto: "ACU0301" }, { x: 121.2, texto: "G1A" }, { x: 150.6, texto: "COMPUTACION I" }, { x: 278.2, texto: "4" }, { x: 291.2, texto: "3" }, { x: 304.2, texto: "7" }, { x: 317.4, texto: "7" }, { x: 325.6, texto: "MORENO RIVERA PEDRO" }, { x: 496.7, texto: "A1" }, { x: 527.1, texto: "11-13" }] },
    ]);

    const json = procesarPrehorarioTexto(paginas);

    expect(Object.keys(json)).toEqual(["S1"]);
    const materia = json.S1.materias[0];
    expect(materia.grupos.map(g => g.grupo)).toEqual(["G1A"]);
    expect(materia.horas).toEqual({ teoricas: 4, practicas: 3, semanales: 7 });
    expect(materia.creditos).toBe(7);
    expect(materia.grupos[0].horario.lunes).toEqual(["11:00-13:00"]);
  });
});