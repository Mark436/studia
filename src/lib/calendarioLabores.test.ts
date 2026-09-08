import { describe, expect, it } from "vitest";
import {
  extraerFechasInicioLabores,
  extraerFechasPublicacionPrehorarios,
} from "./calendarioLabores";

describe("extraerFechasInicioLabores", () => {
  it("extrae las dos fechas del calendario 2026-2 (con espacios del PDF)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  ... 4   Inicio de Labores   03 agosto  5  Cursos intersemestrales  03 al 21 agosto  ... 80  Último día para entrega de listas  ... 81   Inicio de labores   6  de enero 202 6  Nombre  Firma  Fecha";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2026, 7, 3), new Date(2027, 0, 6)]);
  });

  it("lee el año del periodo aunque la etiqueta esté espaciada letra a letra", () => {
    const texto =
      "PERIODO: A G O S T O - D ICIE M B R E 20 26  4 Inicio de Labores 03 agosto";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2026, 7, 3)]);
  });

  it("interpreta el mes abreviado (ago)", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026 ... 70 Inicio de labores 03 ago";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2026, 7, 3)]);
  });

  it("corrige el año del labores de enero al ciclo siguiente aunque el PDF ponga el del periodo", () => {
    const texto = "PERIODO: AGOSTO-DICIEMBRE 2026 ... Inicio de labores 6 de enero 2026";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2027, 0, 6)]);
  });

  it("febrero (mes < agosto) también pertenece al ciclo siguiente", () => {
    const texto = "Inicio de labores 10 febrero 2026";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2027, 1, 10)]);
  });

  it("agosto no se mueve de año incluso con año explícito del periodo", () => {
    const texto = "Inicio de labores 03 agosto 2026";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2026, 7, 3)]);
  });

  it("sin mes usa el año del periodo", () => {
    const texto = "PERIODO: AGOSTO-DICIEMBRE 2026 ... Inicio de labores 14";
    const fechas = extraerFechasInicioLabores(texto);

    expect(fechas).toEqual([new Date(2026, 0, 14)]);
  });

  it("sin menciones devuelve lista vacía", () => {
    expect(extraerFechasInicioLabores("")).toEqual([]);
    expect(extraerFechasInicioLabores("Calendario de festividades")).toEqual([]);
  });
});

describe("extraerFechasPublicacionPrehorarios (actividad 5)", () => {
  it("extrae la fecha del calendario ENERO-JULIO (día en celda, mes de columna)", () => {
    const texto =
      "CALENDARIO ESCOLAR PERIODO: ENERO-JULIO 2026  No.  ACTIVIDAD ENERO  FECHA Y/O PERÍODO ENERO  1 Inicio de labores 7  6 Pago de exámenes de colocación de Idiomas 8 - 10  5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 9  7 Reinscripciones licenciatura 14 al 16  12 Inicio de clases de licenciatura y posgrado 26";
    const fechas = extraerFechasPublicacionPrehorarios(texto);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("soporta los acentos corruptos de la extracción de PDF (├│ = ó)", () => {
    const texto =
      "PERIODO: ENERO-JULIO 2026  ENERO ENERO 1 Inicio de labores 7  Publicaci├│n de orden de reinscripci├│n, referencia bancaria y Prehorarios 9";
    const fechas = extraerFechasPublicacionPrehorarios(texto);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("extrae la fecha del calendario AGOSTO-DICIEMBRE en su columna de agosto", () => {
    const texto =
      "PERIODO: AGOSTO-DICIEMBRE 2026  No. ACTIVIDAD FECHA Y/O PERÍODO AGOSTO AGOSTO 1 Inicio de labores 03 agosto 5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 09 7 Reinscripciones licenciatura 14 al 16";
    const fechas = extraerFechasPublicacionPrehorarios(texto);

    expect(fechas).toEqual([new Date(2026, 7, 9)]);
  });

  it("no suma un año como en inicio de labores (la actividad 5 es del periodo)", () => {
    const texto =
      "PERIODO: ENERO-JULIO 2026  ENERO ENERO 5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 9";
    const fechas = extraerFechasPublicacionPrehorarios(texto);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("ignora la numeración desordenada (el 6 aparece antes que el 5)", () => {
    const texto =
      "PERIODO: ENERO-JULIO 2026  ENERO ENERO 1 Inicio de labores 7 6 Pago de exámenes de colocación de Idiomas 8 - 10 5 Publicación de orden de reinscripción, referencia bancaria y Prehorarios 9 7 Reinscripciones licenciatura 14 al 16";
    const fechas = extraerFechasPublicacionPrehorarios(texto);

    expect(fechas).toEqual([new Date(2026, 0, 9)]);
  });

  it("sin la actividad devuelve lista vacía", () => {
    expect(extraerFechasPublicacionPrehorarios("")).toEqual([]);
    expect(extraerFechasPublicacionPrehorarios("Inicio de labores 03 agosto")).toEqual(
      [],
    );
  });
});