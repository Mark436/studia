import { describe, expect, it } from "vitest";
import type { Alumno } from "sith-api-client";
import {
  getReinscripcionAlert,
  parseReinscripcionDate,
} from "./reinscripcion";

const FECHA_ISO = "2026-12-05T09:00:00-07:00";

function alMomento(restandoMs: number): Date {
  const fecha = new Date(FECHA_ISO);
  return new Date(fecha.getTime() - restandoMs);
}

function alumno(fechaReinscripcion: string): Alumno {
  return { fechaReinscripcion } as Alumno;
}

describe("parseReinscripcionDate", () => {
  it("parsea una fecha ISO de reinscripciÃ³n", () => {
    const fecha = parseReinscripcionDate(alumno(FECHA_ISO));
    expect(fecha).not.toBeNull();
    expect(fecha?.toISOString()).toBe(new Date(FECHA_ISO).toISOString());
  });

  it("devuelve null sin alumno o sin fecha", () => {
    expect(parseReinscripcionDate(null)).toBeNull();
    expect(parseReinscripcionDate(alumno(" "))).toBeNull();
  });

  it("devuelve null si la fecha no es vÃ¡lida", () => {
    expect(parseReinscripcionDate(alumno("no-es-fecha"))).toBeNull();
  });
});

describe("getReinscripcionAlert", () => {
  it("sin fecha no hay aviso", () => {
    expect(getReinscripcionAlert(null, null, new Date(), [])).toBeNull();
  });

  it("si la fecha ya pasÃ³ no hay aviso (ni cuando cambiÃ³)", () => {
    const pasada = new Date(new Date(FECHA_ISO).getTime() + 60_000);
    expect(getReinscripcionAlert(null, FECHA_ISO, pasada, [])).toBeNull();
    expect(
      getReinscripcionAlert("2026-01-01T09:00:00-07:00", FECHA_ISO, pasada, []),
    ).toBeNull();
  });

  it("fuera de las ventanas no hay aviso", () => {
    expect(
      getReinscripcionAlert(null, FECHA_ISO, alMomento(25 * 60 * 60 * 1000), []),
    ).toBeNull();
  });

  it("anuncia la ventana de 24 horas", () => {
    const alert = getReinscripcionAlert(
      null,
      FECHA_ISO,
      alMomento(24 * 60 * 60 * 1000),
      [],
    );
    expect(alert?.kind).toBe("24h");
  });

  it("anuncia la ventana de 5 minutos", () => {
    const alert = getReinscripcionAlert(
      null,
      FECHA_ISO,
      alMomento(5 * 60 * 1000),
      [],
    );
    expect(alert?.kind).toBe("5min");
  });

  it("anuncia la ventana de 10 segundos", () => {
    const alert = getReinscripcionAlert(
      null,
      FECHA_ISO,
      alMomento(10 * 1000),
      [],
    );
    expect(alert?.kind).toBe("10s");
  });

  it("la ventana mÃ¡s estrecha que aplica gana", () => {
    const alert = getReinscripcionAlert(
      null,
      FECHA_ISO,
      alMomento(3 * 60 * 1000),
      [],
    );
    expect(alert?.kind).toBe("5min");
  });

  it("un aviso ya anunciado para esa fecha no se repite", () => {
    expect(
      getReinscripcionAlert(
        null,
        FECHA_ISO,
        alMomento(24 * 60 * 60 * 1000),
        ["24h"],
      ),
    ).toBeNull();
  });

  it("anuncia la siguiente ventana aunque la anterior ya haya pasado", () => {
    const alert = getReinscripcionAlert(
      null,
      FECHA_ISO,
      alMomento(5 * 60 * 1000),
      ["24h"],
    );
    expect(alert?.kind).toBe("5min");
  });

  it("cuando la fecha cambia (y es futura) avisa el cambio", () => {
    const alert = getReinscripcionAlert(
      "2026-05-10T09:00:00-07:00",
      FECHA_ISO,
      new Date(),
      [],
    );
    expect(alert?.kind).toBe("changed");
  });

  it("el cambio de fecha solo se anuncia una vez", () => {
    expect(
      getReinscripcionAlert("2026-05-10T09:00:00-07:00", FECHA_ISO, new Date(), [
        "changed",
      ]),
    ).toBeNull();
  });

  it("una fecha futura sin ventana activa no se anuncia como cambio", () => {
    // Sin fecha previa y fuera de las ventanas: solo las ventanas disparan.
    expect(getReinscripcionAlert(null, FECHA_ISO, new Date(), [])).toBeNull();
  });
});
