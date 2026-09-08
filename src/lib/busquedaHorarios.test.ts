import { describe, expect, it } from "vitest";
import {
  CONFIG_CHEQUEO_HORARIOS,
  decidirFase,
  elegirProximaFechaLabores,
  esHoraChequeo,
  estadoChequeoVacio,
  inicioVentanaVigente,
  parseEstadoChequeo,
  proximoMomentoChequeo,
  serializarEstadoChequeo,
  siguienteVentana,
  tocaAvisarTurnosReinscripcion,
} from "./busquedaHorarios";
import type {
  ConfigChequeoHorarios,
  EstadoChequeoHorarios,
} from "./busquedaHorarios";

function fecha(iso: string): Date {
  return new Date(iso);
}

describe("esHoraChequeo", () => {
  it("false antes de las 18:00, true desde las 18:00", () => {
    expect(esHoraChequeo(new Date(2026, 8, 5, 17, 59))).toBe(false);
    expect(esHoraChequeo(new Date(2026, 8, 5, 18, 0))).toBe(true);
    expect(esHoraChequeo(new Date(2026, 8, 5, 23, 30))).toBe(true);
  });

  it("respeta la hora por parámetro", () => {
    const ahora = new Date(2026, 8, 5, 6, 0);
    expect(esHoraChequeo(ahora, 6)).toBe(true);
    expect(esHoraChequeo(ahora, 7)).toBe(false);
  });

  it("el valor por defecto es el umbral del módulo", () => {
    expect(CONFIG_CHEQUEO_HORARIOS.horaChequeo).toBe(18);
  });
});

describe("proximoMomentoChequeo", () => {
  it("antes de las 18:00 agenda hoy a las 18:00", () => {
    const ahora = new Date(2026, 8, 5, 10, 0);
    expect(proximoMomentoChequeo(ahora).getTime()).toBe(
      new Date(2026, 8, 5, 18, 0).getTime(),
    );
  });

  it("a las 18:00 exactas agenda mañana (ya pasó hoy)", () => {
    const ahora = new Date(2026, 8, 5, 18, 0);
    expect(proximoMomentoChequeo(ahora).getTime()).toBe(
      new Date(2026, 8, 6, 18, 0).getTime(),
    );
  });

  it("después de las 18:00 agenda mañana a las 18:00", () => {
    const ahora = new Date(2026, 8, 5, 20, 0);
    expect(proximoMomentoChequeo(ahora).getTime()).toBe(
      new Date(2026, 8, 6, 18, 0).getTime(),
    );
  });
});

describe("inicioVentanaVigente / siguienteVentana", () => {
  it("la ventana vigente es el inicio más reciente (pasado o presente)", () => {
    expect(inicioVentanaVigente(new Date(2026, 8, 5)).getTime()).toBe(
      new Date(2026, 4, 15).getTime(), // 15 de mayo
    );
    expect(inicioVentanaVigente(new Date(2026, 0, 10)).getTime()).toBe(
      new Date(2025, 11, 15).getTime(), // 15 de diciembre
    );
    expect(inicioVentanaVigente(new Date(2026, 4, 15)).getTime()).toBe(
      new Date(2026, 4, 15).getTime(),
    );
  });

  it("la siguiente ventana es estrictamente posterior a la activa", () => {
    const siguiente = siguienteVentana("2026-05-15T00:00:00", new Date(2026, 8, 5));
    expect(siguiente?.getTime()).toBe(new Date(2026, 11, 15).getTime());
  });

  it("siguienteVentana devuelve null con fecha inválida", () => {
    expect(siguienteVentana("no-es-fecha", new Date(2026, 8, 5))).toBeNull();
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
  const config: ConfigChequeoHorarios = {
    ventanasBusquedaCalendario: [
      { mes: 12, dia: 15 }, // 15 de diciembre
      { mes: 5, dia: 15 }, // 15 de mayo
    ],
    diasTrasLabores: 1,
    horaChequeo: 18,
  };

  function estado(parcial: Partial<EstadoChequeoHorarios>): EstadoChequeoHorarios {
    return { ...estadoChequeoVacio(), ...parcial };
  }

  it("estado vacío dentro de una ventana: toca buscar calendario", () => {
    const r = decidirFase(estado({}), fecha("2026-01-10T12:00:00Z"), config);
    expect(r.fase).toBe("buscar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("estado vacío en la ventana de mayo (AGO-DIC): también busca", () => {
    const r = decidirFase(estado({}), fecha("2026-06-01T12:00:00Z"), config);
    expect(r.fase).toBe("buscar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("con calendario visto: falta procesar (pdfjs)", () => {
    const r = decidirFase(
      estado({
        ventanaActiva: "2025-12-15T00:00:00",
        calendarioVisto: "CALENDARIO_ESCOLAR_2026-2.pdf",
      }),
      fecha("2026-01-10T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("procesar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("con fecha de publicación de prehorarios futura: esperar", () => {
    const r = decidirFase(
      estado({
        ventanaActiva: "2025-12-15T00:00:00",
        fechaPublicacionPrehorarios: fecha("2026-01-09T00:00:00Z"),
      }),
      fecha("2026-01-07T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("esperar-prehorario");
    expect(r.tocaAccion).toBe(false);
  });

  it("la fecha de actividad 5 manda sobre labores + días", () => {
    const r = decidirFase(
      estado({
        ventanaActiva: "2025-12-15T00:00:00",
        fechaInicioLabores: fecha("2026-01-11T00:00:00Z"),
        fechaPublicacionPrehorarios: fecha("2026-01-09T00:00:00Z"),
      }),
      fecha("2026-01-10T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("buscar-prehorario");
    expect(r.tocaAccion).toBe(true);
  });

  it("cumplido inicio de labores + días (sin actividad 5): toca buscar prehorario", () => {
    const r = decidirFase(
      estado({
        ventanaActiva: "2025-12-15T00:00:00",
        fechaInicioLabores: fecha("2026-01-11T00:00:00Z"),
      }),
      fecha("2026-01-13T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("buscar-prehorario");
    expect(r.tocaAccion).toBe(true);
  });

  it("el mismo día del inicio de labores no espera a mañana", () => {
    const r = decidirFase(
      estado({
        ventanaActiva: "2025-12-15T00:00:00",
        fechaInicioLabores: fecha("2026-01-11T00:00:00Z"),
      }),
      fecha("2026-01-11T06:00:00Z"),
      { ...config, diasTrasLabores: 0 },
    );
    expect(r.fase).toBe("buscar-prehorario");
  });

  it("con prehorario visto: completado", () => {
    const r = decidirFase(
      estado({
        ventanaActiva: "2025-12-15T00:00:00",
        fechaInicioLabores: fecha("2026-01-11T00:00:00Z"),
        prehorarioVisto: "PREHORARIO_X_2026-2.pdf",
      }),
      fecha("2026-02-01T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("completado");
    expect(r.tocaAccion).toBe(false);
  });

  it("al comenzar una nueva ventana: reinicia el ciclo", () => {
    const r = decidirFase(
      estado({ ventanaActiva: "2025-12-15T00:00:00" }),
      fecha("2026-05-16T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("siguiente-ventana");
    expect(r.tocaAccion).toBe(true);
  });

  it("la configuración por defecto usa las dos ventanas y 1 día", () => {
    expect(CONFIG_CHEQUEO_HORARIOS.ventanasBusquedaCalendario).toEqual([
      { mes: 12, dia: 15 },
      { mes: 5, dia: 15 },
    ]);
    expect(CONFIG_CHEQUEO_HORARIOS.diasTrasLabores).toBe(1);
  });
});

describe("tocaAvisarTurnosReinscripcion", () => {
  function estado(parcial: Partial<EstadoChequeoHorarios>): EstadoChequeoHorarios {
    return { ...estadoChequeoVacio(), ...parcial };
  }

  // La fecha viene del parser como medianoche local; comparar días locales.
  const publicacion = new Date(2026, 0, 9);

  it("false si aún no se conoce la fecha de publicación", () => {
    expect(tocaAvisarTurnosReinscripcion(estado({}), new Date(2026, 0, 10, 18))).toBe(
      false,
    );
  });

  it("false antes de la fecha", () => {
    const e = estado({ fechaPublicacionPrehorarios: publicacion });
    expect(tocaAvisarTurnosReinscripcion(e, new Date(2026, 0, 8, 23, 59))).toBe(false);
  });

  it("true el mismo día (hora del chequeo)", () => {
    const e = estado({ fechaPublicacionPrehorarios: publicacion });
    expect(tocaAvisarTurnosReinscripcion(e, new Date(2026, 0, 9, 18, 0))).toBe(true);
  });

  it("true después de la fecha", () => {
    const e = estado({ fechaPublicacionPrehorarios: publicacion });
    expect(tocaAvisarTurnosReinscripcion(e, new Date(2026, 0, 20, 18, 0))).toBe(true);
  });

  it("false si ya se avisó", () => {
    const e = estado({
      fechaPublicacionPrehorarios: publicacion,
      avisoTurnosEnviado: true,
    });
    expect(tocaAvisarTurnosReinscripcion(e, new Date(2026, 0, 20, 18, 0))).toBe(false);
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
      calendarioVisto: "CALENDARIO_ESCOLAR_2026-2.pdf",
      ventanaActiva: "2025-12-15T00:00:00",
      fechaInicioLabores: fecha("2027-01-11T00:00:00Z"),
      fechaPublicacionPrehorarios: fecha("2026-01-09T00:00:00Z"),
      prehorarioVisto: null,
      avisoTurnosEnviado: true,
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

  it("tolerante al JSON de ciclos anteriores (con ultimoChequeo)", () => {
    const resultado = parseEstadoChequeo(
      '{"ultimoChequeo":"2026-12-20T12:00:00Z","calendarioVisto":"CALENDARIO_ESCOLAR_2026-2.pdf","fechaInicioLabores":"2027-01-11T00:00:00Z","desconocido":"x"}',
    );
    expect(resultado.calendarioVisto).toBe("CALENDARIO_ESCOLAR_2026-2.pdf");
    expect(resultado.fechaInicioLabores?.toISOString()).toBe(
      "2027-01-11T00:00:00.000Z",
    );
    expect(resultado.ventanaActiva).toBeNull();
    expect(resultado.fechaPublicacionPrehorarios).toBeNull();
    expect(resultado.prehorarioVisto).toBeNull();
    expect(resultado.avisoTurnosEnviado).toBe(false);
  });
});