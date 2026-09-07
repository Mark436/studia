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

  it("una fecha futura descubierta por primera vez avisa discovered", () => {
    const alert = getReinscripcionAlert(
      null,
      FECHA_ISO,
      alMomento(2 * DIA_MS),
      [],
    );
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

  it("una fecha futura lejana descubierta por primera vez avisa discovered", () => {
    expect(
      getReinscripcionAlert(null, FECHA_ISO, alMomento(10 * DIA_MS), []),
    ).toEqual({ kind: "discovered", fecha: new Date(FECHA_ISO) });
  });

  it("una fecha ya descubierta nunca vuelve a avisar estando en el futuro", () => {
    expect(
      getReinscripcionAlert(
        FECHA_ISO,
        FECHA_ISO,
        alMomento(10 * DIA_MS),
        ["discovered"],
      ),
    ).toBeNull();
  });

  it("una fecha ya ocurrida no avisa aunque sea la primera vez", () => {
    const pasada = alMomentoMas(5 * MINUTO_MS);
    expect(getReinscripcionAlert(null, FECHA_ISO, pasada, [])).toBeNull();
  });

  it("una fecha ya ocurrida no vuelve a avisar (ni se re-arranca)", () => {
    const pasada = alMomentoMas(5 * MINUTO_MS);
    expect(
      getReinscripcionAlert(null, FECHA_ISO, pasada, ["discovered"]),
    ).toBeNull();
  });

  it("una fecha pasada hace más de un día sigue sin avisar", () => {
    const pasada = alMomentoMas(2 * DIA_MS);
    expect(getReinscripcionAlert(null, FECHA_ISO, pasada, [])).toBeNull();
  });
});
