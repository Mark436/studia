import { describe, expect, it } from "vitest";
import {
  extraerFechasInicioLabores,
  extraerFechasPublicacionPrehorarios,
  extraerFinDeClases,
} from "./calendarioLabores";

describe("extraerFechasInicioLabores", () => {
  it("extrae las dos fechas del calendario 2026-2 (con espacios del PDF)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  ... 4   Inicio de Labores   03 agosto  5  Cursos intersemestrales  03 al 21 agosto  ... 80  Último día para entrega de listas  ... 81   Inicio de labores   6  de enero 202 6  Nombre  Firma  Fecha";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 3), new Date(2027, 0, 6)]);
  });

  it("lee el año del periodo aunque la etiqueta esté espaciada letra a letra", () => {
    const texto =
      "PERIODO: A G O S T O - D ICIE M B R E 20 26  4 Inicio de Labores 03 agosto";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 3)]);
  });

  it("interpreta el mes abreviado (ago)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026 ... 70 Inicio de labores 03 ago";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 3)]);
  });

  it("corrige el año del labores de enero al ciclo siguiente aunque el PDF ponga el del periodo", () => {
    const texto = "PERIODO: AGOSTO-DICIEMBRE 2026 ... Inicio de labores 6 de enero 2026";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2027, 0, 6)]);
  });

  it("febrero (mes < agosto) también pertenece al ciclo siguiente", () => {
    const texto = "Inicio de labores 10 febrero 2026";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2027, 1, 10)]);
  });

  it("agosto no se mueve de año incluso con año explícito del periodo", () => {
    const texto = "Inicio de labores 03 agosto 2026";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 3)]);
  });

  it("sin mes usa el año del periodo", () => {
    const texto = "PERIODO: AGOSTO-DICIEMBRE 2026 ... Inicio de labores 14";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 0, 14)]);
  });

  it("sin menciones devuelve lista vacía", () => {
    expect(extraerFechasInicioLabores("", 2026)).toEqual([]);
    expect(extraerFechasInicioLabores("Calendario de festividades", 2026)).toEqual([]);
  });

  it("extrae las fechas del PDF real 2026-2 (etiqueta y fechas espaciadas letra a letra)", () => {
    const texto =
      "P E R IODO: A G O S T O - D ICIE M B R E 20 26  A G O S T O  4   Inicio de Labores   03 agosto  81   Inicio de labores   6   de enero 202 6";
    const fechas = extraerFechasInicioLabores(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 3), new Date(2027, 0, 6)]);
  });
});

describe("extraerFinDeClases", () => {
  it("extrae el último día de clases del periodo AGOSTO-DICIEMBRE (del calendario 2026-2)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  No.  ACTIVIDAD  FECHA Y/O PERÍODO  75  Fin de clases  11 de diciembre  76  Fin de cursos de idiomas  11 de diciembre  77  Fin de cursos de Actividades Extraescolares  04 de diciembre";
    const fin = extraerFinDeClases(texto);

    expect(fin).toEqual(new Date(2026, 11, 11));
  });

  it("con más de una fila se queda con la más tardía (licenciatura vs idiomas)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  Fin de clases de licenciatura y posgrado  28 de mayo  Fin de clases de idiomas  29 de mayo";
    const fin = extraerFinDeClases(texto);

    expect(fin).toEqual(new Date(2026, 4, 29));
  });

  it("no cuenta el fin de cursos de actividades extraescolares (terminan antes)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  Fin de cursos de Actividades Extraescolares  04 de diciembre  75  Fin de clases  11 de diciembre";
    const fin = extraerFinDeClases(texto);

    expect(fin).toEqual(new Date(2026, 11, 11));
  });

  it("no le aplica la regla +1 año del inicio de labores (el fin de clases es del propio periodo)", () => {
    const texto = "PERIODO: ENERO-JULIO 2026  Fin de clases 29 de mayo 2026";
    const fin = extraerFinDeClases(texto);

    expect(fin).toEqual(new Date(2026, 4, 29));
  });

  it("sin fila de fin de clases devuelve null", () => {
    expect(extraerFinDeClases("")).toBeNull();
    expect(extraerFinDeClases("PERIODO: AGOSTO-DICIEMBRE 2026  4 Inicio de labores 03 agosto")).toBeNull();
  });

  it("extrae el fin de clases del PDF real 2026-2 (texto espaciado letra a letra)", () => {
    const texto =
      "P E R IODO: A G O S T O - D ICIE M B R E 20 26  D ICIE M B R E  74  F i n de  c ur sos  d e Act i vid a des  E x t ra esco lar es  04 de diciembre  75  F i n de  cl as es   11 de diciembre  76  F i n de  c u r sos  d e idi o m a s   11  de  diciemb r e";
    const fin = extraerFinDeClases(texto);

    expect(fin).toEqual(new Date(2026, 11, 11));
  });
});

describe("extraerFechasPublicacionPrehorarios (actividad 5)", () => {
  it("extrae la fecha del calendario ENERO-JULIO (día en celda, mes de columna)", () => {
    const texto =
      "CALENDARIO ESCOLAR PERIODO: ENERO-JULIO 2026  No.  ACTIVIDAD ENERO  FECHA Y/O PERÍODO ENERO  1 Inicio de labores 7  6 Pago de exámenes de colocación de Idiomas 8 - 10  5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 9  7 Reinscripciones licenciatura 14 al 16  12 Inicio de clases de licenciatura y posgrado 26";
    const fechas = extraerFechasPublicacionPrehorarios(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("soporta los acentos corruptos de la extracción de PDF (├│ = ó)", () => {
    const texto =
      "PERIODO: ENERO-JULIO 2026  ENERO ENERO 1 Inicio de labores 7  Publicaci├│n de orden de reinscripci├│n, referencia bancaria y Prehorarios 9";
    const fechas = extraerFechasPublicacionPrehorarios(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("extrae la fecha del calendario AGOSTO-DICIEMBRE en su columna de agosto", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  No. ACTIVIDAD FECHA Y/O PERÍODO AGOSTO AGOSTO 1 Inicio de labores 03 agosto 5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 09 7 Reinscripciones licenciatura 14 al 16";
    const fechas = extraerFechasPublicacionPrehorarios(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 9)]);
  });

  it("no suma un año como en inicio de labores (la actividad 5 es del periodo)", () => {
    const texto =
      "PERIODO: ENERO-JULIO 2026  ENERO ENERO 5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 9";
    const fechas = extraerFechasPublicacionPrehorarios(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("ignora la numeración desordenada (el 6 aparece antes que el 5)", () => {
    const texto =
      "PERIODO: ENERO-JULIO 2026  ENERO ENERO 1 Inicio de labores 7 6 Pago de exámenes de colocación de Idiomas 8 - 10 5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 9 7 Reinscripciones licenciatura 14 al 16";
    const fechas = extraerFechasPublicacionPrehorarios(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("sin la actividad devuelve lista vacía", () => {
    expect(extraerFechasPublicacionPrehorarios("", 2026)).toEqual([]);
    expect(extraerFechasPublicacionPrehorarios("Inicio de labores 03 agosto", 2026)).toEqual(
      [],
    );
  });

  it("extrae la fecha de la actividad 11 del PDF real 2026-2 (encabezados espaciados)", () => {
    const texto =
      "P E R IODO: A G O S T O - D ICIE M B R E 20 26  A G O S T O  10  Aplicación de exámenes de colocación inglés  12 y 13 de agosto  11  Publicación  orden  de  reinscripción  y  horarios,  y  referencia bancaria para estudiantes de reingreso  13 de agosto";
    const fechas = extraerFechasPublicacionPrehorarios(texto, 2026);

    expect(fechas).toEqual([new Date(2026, 7, 13)]);
  });
});