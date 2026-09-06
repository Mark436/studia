import { describe, expect, it } from "vitest";
import { extraerFechasInicioLabores } from "./calendarioLabores";

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