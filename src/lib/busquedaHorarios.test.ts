import { describe, expect, it } from "vitest";
import {
  CONFIG_CHEQUEO_HORARIOS,
  decidirFase,
  elegirProximaFechaLabores,
  estadoChequeoVacio,
  FECHA_INICIO_BUSQUEDA_CALENDARIO,
  HORAS_ENTRE_CHEQUEOS,
  parseEstadoChequeo,
  serializarEstadoChequeo,
  tocaChequear,
} from "./busquedaHorarios";
import type {
  ConfigChequeoHorarios,
  EstadoChequeoHorarios,
} from "./busquedaHorarios";

function fecha(iso: string): Date {
  return new Date(iso);
}

describe("tocaChequear", () => {
  const ahora = fecha("2026-09-05T12:00:00Z");

  it("devuelve true si nunca se chequeó", () => {
    expect(tocaChequear(null, ahora)).toBe(true);
  });

  it("devuelve true al cumplirse las 24 horas", () => {
    const ultimo = fecha("2026-09-04T12:00:00Z");
    expect(tocaChequear(ultimo, ahora)).toBe(true);
  });

  it("devuelve false antes de las 24 horas", () => {
    const ultimo = fecha("2026-09-04T20:00:00Z");
    expect(tocaChequear(ultimo, ahora)).toBe(false);
  });

  it("devuelve false si el último chequeo es del futuro", () => {
    const ultimo = fecha("2026-09-06T12:00:00Z");
    expect(tocaChequear(ultimo, ahora)).toBe(false);
  });

  it("respeta horas personalizadas", () => {
    const ultimo = fecha("2026-09-05T06:00:00Z");
    expect(tocaChequear(ultimo, ahora, 6)).toBe(true);
    expect(tocaChequear(ultimo, ahora, 7)).toBe(false);
  });

  it("el valor por defecto es el umbral del módulo", () => {
    expect(HORAS_ENTRE_CHEQUEOS).toBe(24);
  });
});

describe("elegirProximaFechaLabores", () => {
  const ahora = fecha("2026-09-05T12:00:00Z");

  it("elige la futura más próxima", () => {
    const elegida = elegirProximaFechaLabores(
      [
        fecha("2027-01-04T00:00:00Z"),
        fecha("2026-08-03T00:00:00Z"),
        fecha("2026-09-10T00:00:00Z"),
      ],
      ahora,
    );
    expect(elegida?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("descarta la del periodo ya iniciado", () => {
    const elegida = elegirProximaFechaLabores(
      [fecha("2026-08-03T00:00:00Z"), fecha("2027-01-04T00:00:00Z")],
      ahora,
    );
    expect(elegida?.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });

  it("descarta la del momento exacto de ahora", () => {
    const elegida = elegirProximaFechaLabores([ahora], ahora);
    expect(elegida).toBeNull();
  });

  it("devuelve null si todas ya pasaron", () => {
    const elegida = elegirProximaFechaLabores(
      [fecha("2026-01-10T00:00:00Z"), fecha("2026-08-03T00:00:00Z")],
      ahora,
    );
    expect(elegida).toBeNull();
  });

  it("devuelve null sin fechas", () => {
    expect(elegirProximaFechaLabores([], ahora)).toBeNull();
  });

  it("no muta el arreglo de entrada", () => {
    const fechas = [fecha("2027-01-04T00:00:00Z"), fecha("2026-09-10T00:00:00Z")];
    const original = fechas.map(it => it.getTime());
    elegirProximaFechaLabores(fechas, ahora);
    expect(fechas.map(it => it.getTime())).toEqual(original);
  });
});

describe("decidirFase", () => {
  const arranque = fecha("2026-12-15T00:00:00Z");
  const config: ConfigChequeoHorarios = {
    arranqueBusquedaCalendario: arranque,
    diasTrasLabores: 1,
  };

  function estado(parcial: Partial<EstadoChequeoHorarios>): EstadoChequeoHorarios {
    return { ...estadoChequeoVacio(), ...parcial };
  }

  it("antes del arranque: no toca buscar calendario", () => {
    const ahora = fecha("2026-09-05T12:00:00Z");
    const r = decidirFase(estado({}), ahora, config);
    expect(r.fase).toBe("antes-buscar-calendario");
    expect(r.tocaAccion).toBe(false);
  });

  it("desde el arranque sin calendario visto: toca buscar calendario", () => {
    const ahora = fecha("2026-12-20T12:00:00Z");
    const r = decidirFase(estado({}), ahora, config);
    expect(r.fase).toBe("buscar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("con calendario visto: falta procesar (pdfjs)", () => {
    const ahora = fecha("2026-12-20T12:00:00Z");
    const r = decidirFase(
      estado({ calendarioVisto: "CALENDARIO_ESCOLAR_2026-2.pdf" }),
      ahora,
      config,
    );
    expect(r.fase).toBe("procesar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("con inicio de labores futuro: esperar", () => {
    const ahora = fecha("2026-12-24T12:00:00Z");
    const r = decidirFase(
      estado({ fechaInicioLabores: fecha("2027-01-11T00:00:00Z") }),
      ahora,
      config,
    );
    expect(r.fase).toBe("esperar-labores");
    expect(r.tocaAccion).toBe(false);
  });

  it("cumplido inicio de labores + días: toca buscar prehorario", () => {
    const ahora = fecha("2027-01-13T12:00:00Z");
    const r = decidirFase(
      estado({ fechaInicioLabores: fecha("2027-01-11T00:00:00Z") }),
      ahora,
      config,
    );
    expect(r.fase).toBe("buscar-prehorario");
    expect(r.tocaAccion).toBe(true);
  });

  it("el mismo día del inicio de labores no espera a mañana", () => {
    const ahora = fecha("2027-01-11T06:00:00Z");
    const r = decidirFase(
      estado({ fechaInicioLabores: fecha("2027-01-11T00:00:00Z") }),
      ahora,
      { ...config, diasTrasLabores: 0 },
    );
    expect(r.fase).toBe("buscar-prehorario");
  });

  it("con prehorario visto: completado", () => {
    const ahora = fecha("2027-02-01T12:00:00Z");
    const r = decidirFase(
      estado({
        fechaInicioLabores: fecha("2027-01-11T00:00:00Z"),
        prehorarioVisto: "PREHORARIO_X_2026-2.pdf",
      }),
      ahora,
      config,
    );
    expect(r.fase).toBe("completado");
    expect(r.tocaAccion).toBe(false);
  });

  it("arranque null: no toca buscar calendario nunca", () => {
    const ahora = fecha("2027-12-20T12:00:00Z");
    const r = decidirFase(estado({}), ahora, {
      arranqueBusquedaCalendario: null,
      diasTrasLabores: 1,
    });
    expect(r.fase).toBe("antes-buscar-calendario");
  });

  it("el arranque por defecto es el 15 de diciembre de 2026 (medianoche local)", () => {
    expect(FECHA_INICIO_BUSQUEDA_CALENDARIO.getTime()).toBe(
      new Date(2026, 11, 15).getTime(),
    );
    expect(FECHA_INICIO_BUSQUEDA_CALENDARIO.getHours()).toBe(0);
    expect(FECHA_INICIO_BUSQUEDA_CALENDARIO.getMinutes()).toBe(0);
    expect(CONFIG_CHEQUEO_HORARIOS.diasTrasLabores).toBe(1);
  });
});

describe("parsear / serializar estado", () => {
  it("round-trip vacío", () => {
    const original = estadoChequeoVacio();
    expect(parseEstadoChequeo(serializarEstadoChequeo(original))).toEqual(
      original,
    );
  });

  it("round-trip con fechas y archivos", () => {
    const original: EstadoChequeoHorarios = {
      ultimoChequeo: fecha("2026-12-20T12:00:00Z"),
      calendarioVisto: "CALENDARIO_ESCOLAR_2026-2.pdf",
      fechaInicioLabores: fecha("2027-01-11T00:00:00Z"),
      prehorarioVisto: null,
    };
    const resultado = parseEstadoChequeo(serializarEstadoChequeo(original));
    expect(resultado).toEqual(original);
  });

  it("parse de null devuelve estado vacío", () => {
    expect(parseEstadoChequeo(null)).toEqual(estadoChequeoVacio());
  });

  it("parse de JSON inválido devuelve estado vacío", () => {
    expect(parseEstadoChequeo("{no-json")).toEqual(estadoChequeoVacio());
  });

  it("parse de JSON sin campos desconocidos conserva los válidos", () => {
    const resultado = parseEstadoChequeo(
      '{"ultimoChequeo":"2026-12-20T12:00:00Z","desconocido":"x"}',
    );
    expect(resultado.ultimoChequeo?.toISOString()).toBe(
      "2026-12-20T12:00:00.000Z",
    );
    expect(resultado.calendarioVisto).toBeNull();
  });
});