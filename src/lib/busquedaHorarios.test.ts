import { describe, expect, it } from "vitest";
import {
  CONFIG_CHEQUEO_HORARIOS,
  decidirFase,
  elegirProximaFechaLabores,
  enVentanaVacacional,
  esHoraChequeo,
  estadoChequeoVacio,
  estadoTrasAplicarCalendario,
  parseEstadoChequeo,
  pasoTiempoBusquedaCalendario,
  proximoMomentoChequeo,
  serializarEstadoChequeo,
  tocaAvisarTurnosReinscripcion,
} from "./busquedaHorarios";
import type {
  ConfigChequeoHorarios,
  EstadoChequeoHorarios,
} from "./busquedaHorarios";

function fecha(iso: string): Date {
  return new Date(iso);
}

/** Fechas ancla del ciclo AGO-DIC 2026 (invierno): fin 11-dic → inicio 6-ene. */
const invierno = {
  fechaFinDeClases: new Date(2026, 11, 11),
  fechaInicioLabores: new Date(2027, 0, 6),
};

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

describe("enVentanaVacacional", () => {
  it("true entre fin de clases e inicio de labores del siguiente ciclo", () => {
    expect(enVentanaVacacional(invierno, new Date(2026, 11, 20))).toBe(true);
  });

  it("true el mismo día del fin de clases", () => {
    expect(enVentanaVacacional(invierno, new Date(2026, 11, 11, 18))).toBe(true);
  });

  it("false antes del fin de clases (aún hay clases)", () => {
    expect(enVentanaVacacional(invierno, new Date(2026, 9, 5))).toBe(false);
  });

  it("false desde el inicio de labores del siguiente ciclo", () => {
    expect(enVentanaVacacional(invierno, new Date(2027, 0, 6, 0, 0))).toBe(false);
    expect(enVentanaVacacional(invierno, new Date(2027, 0, 20))).toBe(false);
  });

  it("false si falta alguna fecha", () => {
    expect(enVentanaVacacional({ ...invierno, fechaFinDeClases: null }, new Date(2026, 11, 20))).toBe(false);
    expect(enVentanaVacacional({ ...invierno, fechaInicioLabores: null }, new Date(2026, 11, 20))).toBe(false);
  });

  it("false si las fechas están invertidas (fin > inicio tras procesar el ciclo siguiente)", () => {
    const invertido = {
      fechaFinDeClases: new Date(2027, 4, 29),
      fechaInicioLabores: new Date(2027, 0, 6),
    };
    expect(enVentanaVacacional(invertido, new Date(2027, 0, 20))).toBe(false);
  });
});

describe("pasoTiempoBusquedaCalendario", () => {
  const config: ConfigChequeoHorarios = {
    diasEntreBusquedasCalendario: 7,
    diasTrasLabores: 1,
    horaChequeo: 18,
  };
  const ahora = fecha("2026-12-20T18:00:00");

  it("true si nunca se ha buscado o la fecha es inválida", () => {
    expect(pasoTiempoBusquedaCalendario(estadoChequeoVacio(), ahora, config)).toBe(true);
    expect(
      pasoTiempoBusquedaCalendario(
        { ...estadoChequeoVacio(), ultimaBusquedaCalendario: "no-fecha" },
        ahora,
        config,
      ),
    ).toBe(true);
  });

  it("false si aún no pasan 7 días desde la última búsqueda", () => {
    const haceMenos = new Date(2026, 11, 15, 18, 0).toISOString();
    expect(
      pasoTiempoBusquedaCalendario(
        { ...estadoChequeoVacio(), ultimaBusquedaCalendario: haceMenos },
        ahora,
        config,
      ),
    ).toBe(false);
  });

  it("true si pasaron exactamente 7 días", () => {
    const hace7 = new Date(2026, 11, 13, 18, 0).toISOString();
    expect(
      pasoTiempoBusquedaCalendario(
        { ...estadoChequeoVacio(), ultimaBusquedaCalendario: hace7 },
        ahora,
        config,
      ),
    ).toBe(true);
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

  it("devuelve null si todas ya pasaron o no hay fechas", () => {
    expect(elegirProximaFechaLabores([fecha("2026-01-10T00:00:00Z")], ahora)).toBeNull();
    expect(elegirProximaFechaLabores([], ahora)).toBeNull();
  });
});

describe("decidirFase", () => {
  const config: ConfigChequeoHorarios = {
    diasEntreBusquedasCalendario: 7,
    diasTrasLabores: 1,
    horaChequeo: 18,
  };

  function estado(parcial: Partial<EstadoChequeoHorarios>): EstadoChequeoHorarios {
    return { ...estadoChequeoVacio(), ...parcial };
  }

  it("un calendario nuevo detectado manda sobre las vacaciones: procesar", () => {
    const r = decidirFase(
      estado({
        ...invierno,
        calendarioVisto: "CALENDARIO_ESCOLAR_2027-1.pdf",
        calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
      }),
      fecha("2026-12-20T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("procesar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("dentro de la ventana vacacional: toca buscar el calendario", () => {
    const r = decidirFase(
      estado({ ...invierno, calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf" }),
      fecha("2026-12-20T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("buscar-calendario");
    expect(r.tocaAccion).toBe(true);
  });

  it("fuera de vacaciones el estado vacío no busca calendario: sin-datos", () => {
    const r = decidirFase(estado({}), fecha("2026-09-05T12:00:00Z"), config);
    expect(r.fase).toBe("sin-datos");
    expect(r.tocaAccion).toBe(false);
  });

  it("con calendario ya aplicado y sin prehorario visto, espera la actividad 5", () => {
    const r = decidirFase(
      estado({
        ...invierno,
        calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
        fechaPublicacionPrehorarios: fecha("2027-01-09T00:00:00Z"),
      }),
      fecha("2027-01-06T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("esperar-prehorario");
    expect(r.tocaAccion).toBe(false);
  });

  it("cumplida la fecha de la actividad 5: buscar prehorario", () => {
    const r = decidirFase(
      estado({
        ...invierno,
        calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
        fechaPublicacionPrehorarios: fecha("2027-01-09T00:00:00Z"),
      }),
      fecha("2027-01-10T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("buscar-prehorario");
    expect(r.tocaAccion).toBe(true);
  });

  it("cumplido inicio de labores + días (sin actividad 5): buscar prehorario", () => {
    const r = decidirFase(
      estado({
        ...invierno,
        calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
        fechaInicioLabores: new Date(2027, 0, 6),
      }),
      fecha("2027-01-10T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("buscar-prehorario");
    expect(r.tocaAccion).toBe(true);
  });

  it("con prehorario visto fuera de vacaciones: completado", () => {
    const r = decidirFase(
      estado({
        ...invierno,
        calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
        prehorarioVisto: "PREHORARIO_X_2026-2.pdf",
      }),
      fecha("2026-10-15T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("completado");
    expect(r.tocaAccion).toBe(false);
  });

  it("con prehorario visto dentro de las vacaciones: buscar calendario manda", () => {
    const r = decidirFase(
      estado({
        ...invierno,
        calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
        prehorarioVisto: "PREHORARIO_X_2026-2.pdf",
      }),
      fecha("2026-12-20T12:00:00Z"),
      config,
    );
    expect(r.fase).toBe("buscar-calendario");
  });

  it("la configuración por defecto usa 7 días entre búsquedas y 1 día tras labores", () => {
    expect(CONFIG_CHEQUEO_HORARIOS.diasEntreBusquedasCalendario).toBe(7);
    expect(CONFIG_CHEQUEO_HORARIOS.diasTrasLabores).toBe(1);
  });
});

describe("estadoTrasAplicarCalendario", () => {
  it("archivo nuevo: reinaugura el ciclo de prehorario", () => {
    const estado: EstadoChequeoHorarios = {
      ...estadoChequeoVacio(),
      calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
      calendarioVisto: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
      prehorarioVisto: "PREHORARIO_X_2026-2.pdf",
      avisoTurnosEnviado: true,
    };
    const lectura = {
      fechas: [new Date(2027, 0, 6), new Date(2027, 7, 3)],
      publicacionPrehorarios: [new Date(2027, 0, 9)],
      finDeClases: new Date(2027, 4, 29),
    };
    const resultado = estadoTrasAplicarCalendario(
      estado,
      lectura,
      "CALENDARIO_ESCOLAR_2027-1.pdf",
      fecha("2026-12-20T12:00:00Z"),
    );

    expect(resultado.calendarioProcesado).toBe("CALENDARIO_ESCOLAR_2027-1.pdf");
    expect(resultado.calendarioVisto).toBe("CALENDARIO_ESCOLAR_2027-1.pdf");
    expect(resultado.fechaInicioLabores?.getTime()).toBe(new Date(2027, 0, 6).getTime());
    expect(resultado.fechaFinDeClases?.getTime()).toBe(new Date(2027, 4, 29).getTime());
    expect(resultado.fechaPublicacionPrehorarios?.getTime()).toBe(new Date(2027, 0, 9).getTime());
    expect(resultado.prehorarioVisto).toBeNull();
    expect(resultado.avisoTurnosEnviado).toBe(false);
  });

  it("mismo archivo: solo completa las fechas, no resetea el ciclo", () => {
    const estado: EstadoChequeoHorarios = {
      ...estadoChequeoVacio(),
      calendarioProcesado: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
      calendarioVisto: "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
      prehorarioVisto: "PREHORARIO_X_2026-2.pdf",
      avisoTurnosEnviado: true,
    };
    const resultado = estadoTrasAplicarCalendario(
      estado,
      {
        fechas: [new Date(2026, 7, 3), new Date(2027, 0, 6)],
        publicacionPrehorarios: [],
        finDeClases: new Date(2026, 11, 11),
      },
      "CALENDARIO_ESCOLAR_2026-2 V2.pdf",
      fecha("2026-09-05T12:00:00Z"),
    );

    expect(resultado.prehorarioVisto).toBe("PREHORARIO_X_2026-2.pdf");
    expect(resultado.avisoTurnosEnviado).toBe(true);
    expect(resultado.fechaFinDeClases?.getTime()).toBe(new Date(2026, 11, 11).getTime());
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
      calendarioVisto: "CALENDARIO_ESCOLAR_2027-1.pdf",
      calendarioProcesado: "CALENDARIO_ESCOLAR_2027-1.pdf",
      fechaFinDeClases: new Date(2027, 4, 29),
      fechaInicioLabores: fecha("2027-08-03T00:00:00Z"),
      fechaPublicacionPrehorarios: fecha("2027-01-09T00:00:00Z"),
      prehorarioVisto: null,
      avisoTurnosEnviado: true,
      ultimaBusquedaCalendario: "2026-12-20T18:00:00.000Z",
    };
    const resultado = parseEstadoChequeo(serializarEstadoChequeo(original));
    expect(resultado).toEqual(original);
  });

  it("parse de null o JSON inválido devuelve estado vacío", () => {
    expect(parseEstadoChequeo(null)).toEqual(estadoChequeoVacio());
    expect(parseEstadoChequeo("{no-json")).toEqual(estadoChequeoVacio());
  });

  it("migra el estado de las ventanas antiguas: el calendario visto se asume procesado", () => {
    const resultado = parseEstadoChequeo(
      '{"calendarioVisto":"CALENDARIO_ESCOLAR_2026-2 v2.pdf","ventanaActiva":"2026-05-15T00:00:00","fechaInicioLabores":"2027-01-11T00:00:00Z","fechaPublicacionPrehorarios":"2026-08-13T00:00:00Z","prehorarioVisto":"PREHORARIO_X_2026-2.pdf","avisoTurnosEnviado":true}',
    );
    expect(resultado.calendarioVisto).toBe("CALENDARIO_ESCOLAR_2026-2 v2.pdf");
    expect(resultado.calendarioProcesado).toBe("CALENDARIO_ESCOLAR_2026-2 v2.pdf");
    expect(resultado.fechaInicioLabores?.toISOString()).toBe("2027-01-11T00:00:00.000Z");
    expect(resultado.fechaFinDeClases).toBeNull();
    expect(resultado.ultimaBusquedaCalendario).toBeNull();
    expect(resultado.avisoTurnosEnviado).toBe(true);
  });

  it("tolerante al JSON de ciclos anteriores (con ultimoChequeo)", () => {
    const resultado = parseEstadoChequeo(
      '{"ultimoChequeo":"2026-12-20T12:00:00Z","calendarioVisto":"CALENDARIO_ESCOLAR_2026-2.pdf","fechaInicioLabores":"2027-01-11T00:00:00Z","desconocido":"x"}',
    );
    expect(resultado.calendarioProcesado).toBe("CALENDARIO_ESCOLAR_2026-2.pdf");
    expect(resultado.fechaInicioLabores?.toISOString()).toBe("2027-01-11T00:00:00.000Z");
    expect(resultado.fechaFinDeClases).toBeNull();
    expect(resultado.fechaPublicacionPrehorarios).toBeNull();
    expect(resultado.prehorarioVisto).toBeNull();
    expect(resultado.avisoTurnosEnviado).toBe(false);
  });
});