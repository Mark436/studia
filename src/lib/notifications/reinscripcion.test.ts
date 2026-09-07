import { describe, expect, it } from "vitest";
import type { Alumno } from "sith-api-client";
import {
  getReinscripcionAlert,
  getTimeUntilReinscripcion,
  parseReinscripcionDate,
} from "./reinscripcion";

const FECHA_ISO = "2026-12-05T09:00:00-07:00";

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;

function alMomento(restandoMs: number): Date {
  const fecha = new Date(FECHA_ISO);
  return new Date(fecha.getTime() - restandoMs);
}

function alMomentoMas(sumasMs: number): Date {
  const fecha = new Date(FECHA_ISO);
  return new Date(fecha.getTime() + sumasMs);
}

function alumno(fechaReinscripcion: string): Alumno {
  return { fechaReinscripcion } as Alumno;
}

describe("parseReinscripcionDate", () => {
  it("parsea una fecha ISO de reinscripción", () => {
    const fecha = parseReinscripcionDate(alumno(FECHA_ISO));
    expect(fecha).not.toBeNull();
    expect(fecha?.toISOString()).toBe(new Date(FECHA_ISO).toISOString());
  });

  it("devuelve null sin alumno o sin fecha", () => {
    expect(parseReinscripcionDate(null)).toBeNull();
    expect(parseReinscripcionDate(alumno(" "))).toBeNull();
  });

  it("devuelve null si la fecha no es válida", () => {
    expect(parseReinscripcionDate(alumno("no-es-fecha"))).toBeNull();
  });
});

describe("getTimeUntilReinscripcion", () => {
  it("sin fecha devuelve no-date", () => {
    expect(getTimeUntilReinscripcion(null, new Date())).toEqual({
      status: "no-date",
      fecha: null,
    });
  });

  it("fecha futura devuelve los días/horas/minutos restantes", () => {
    const now = alMomento(1 * DIA_MS + 2 * HORA_MS + 3 * MINUTO_MS);
    expect(getTimeUntilReinscripcion(alumno(FECHA_ISO), now)).toEqual({
      status: "future",
      // fecha y unidades: exacto contra el helper con las mismas constantes.
      fecha: new Date(FECHA_ISO),
      days: expect.any(Number),
      hours: expect.any(Number),
      minutes: expect.any(Number),
    });
  });

  it("fecha futura: resta correcta", () => {
    const now = alMomento(1 * DIA_MS + 2 * HORA_MS + 3 * MINUTO_MS);
    const result = getTimeUntilReinscripcion(alumno(FECHA_ISO), now);
    expect(result.status).toBe("future");
    if (result.status !== "future") return;
    expect(result.days).toBe(1);
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(3);
  });

  it("fecha recién pasada devuelve active", () => {
    const now = alMomentoMas(5 * MINUTO_MS);
    const result = getTimeUntilReinscripcion(alumno(FECHA_ISO), now);
    expect(result.status).toBe("active");
    if (result.status !== "active") return;
    expect(result.minutes).toBe(5);
    expect(result.hours).toBe(0);
  });

  it("fecha pasada hace > 24h devuelve past", () => {
    const now = alMomentoMas(2 * DIA_MS);
    expect(getTimeUntilReinscripcion(alumno(FECHA_ISO), now)).toEqual({
      status: "past",
      fecha: new Date(FECHA_ISO),
    });
  });
});

describe("getReinscripcionAlert", () => {
  it("sin fecha no hay aviso", () => {
    expect(getReinscripcionAlert(null, null, new Date(), [])).toBeNull();
  });

  it("un fecha futura descubierta por primera vez avisa discovered", () => {
    const alert = getReinscripcionAlert(null, FECHA_ISO, alMomento(2 * DIA_MS), []);
    expect(alert?.kind).toBe("discovered");
  });

  it("una fecha futura previamente conocida no repite discovered", () => {
    expect(
      getReinscripcionAlert(FECHA_ISO, FECHA_ISO, alMomento(2 * DIA_MS), []),
    ).toBeNull();
  });

  it("cuando la fecha cambia (y es futura) avisa el cambio como discovered", () => {
    const alert = getReinscripcionAlert(
      "2026-05-10T09:00:00-07:00",
      FECHA_ISO,
      new Date(),
      [],
    );
    expect(alert?.kind).toBe("discovered");
  });

  it("el discovered solo se anuncia una vez por fecha", () => {
    expect(
      getReinscripcionAlert("2026-05-10T09:00:00-07:00", FECHA_ISO, new Date(), [
        "discovered",
      ]),
    ).toBeNull();
  });

  it("al descubrir una fecha lejana por primera vez avisa discovered", () => {
    expect(
      getReinscripcionAlert(null, FECHA_ISO, alMomento(10 * DIA_MS), []),
    ).toEqual({ kind: "discovered", fecha: new Date(FECHA_ISO) });
  });

  it("fuera de las ventanas y ya descubierta no hay aviso", () => {
    expect(
      getReinscripcionAlert(
        FECHA_ISO,
        FECHA_ISO,
        alMomento(10 * DIA_MS),
        ["discovered"],
      ),
    ).toBeNull();
  });

  it("anuncia la ventana de 24 horas", () => {
    const alert = getReinscripcionAlert(
      FECHA_ISO,
      FECHA_ISO,
      alMomento(24 * 60 * 60 * 1000),
      ["discovered"],
    );
    expect(alert?.kind).toBe("24h");
  });

  it("anuncia la ventana de 30 minutos", () => {
    const alert = getReinscripcionAlert(
      FECHA_ISO,
      FECHA_ISO,
      alMomento(30 * 60 * 1000),
      ["discovered", "24h"],
    );
    expect(alert?.kind).toBe("30min");
  });

  it("la ventana más estrecha que aplica gana", () => {
    const alert = getReinscripcionAlert(
      FECHA_ISO,
      FECHA_ISO,
      alMomento(10 * 60 * 1000),
      ["discovered"],
    );
    expect(alert?.kind).toBe("30min");
  });

  it("un aviso ya anunciado para esa fecha no se repite", () => {
    expect(
      getReinscripcionAlert(
        FECHA_ISO,
        FECHA_ISO,
        alMomento(24 * 60 * 60 * 1000),
        ["discovered", "24h"],
      ),
    ).toBeNull();
  });

  it("anuncia la siguiente ventana aunque la anterior ya haya pasado", () => {
    const alert = getReinscripcionAlert(
      FECHA_ISO,
      FECHA_ISO,
      alMomento(30 * 60 * 1000),
      ["discovered", "24h"],
    );
    expect(alert?.kind).toBe("30min");
  });

  it("una fecha futura sin ventana activa (pero ya descubierta) no avisa", () => {
    expect(
      getReinscripcionAlert(
        FECHA_ISO,
        FECHA_ISO,
        new Date(),
        ["discovered"],
      ),
    ).toBeNull();
  });

  it("cuando el turno ya empezó avisa start (una vez)", () => {
    const pasada = alMomentoMas(5 * 60 * 1000);
    const alert = getReinscripcionAlert(null, FECHA_ISO, pasada, []);
    expect(alert?.kind).toBe("start");
    expect(
      getReinscripcionAlert(null, FECHA_ISO, pasada, ["start"]),
    ).toBeNull();
  });
});
