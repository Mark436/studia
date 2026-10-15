import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapHorario } from "@/features/schedule/mapHorario";
import {
  clearAllStores,
  enableInMemoryStorage,
  getValue,
  putValue,
  STORE_APP_DATA,
} from "@/lib/storage/db";
import { loadAppData, saveAppData } from "@/lib/storage/appDataStore";
import { DEMO_ALUMNO, DEMO_AVISOS } from "./data";
import { isDemoMode } from "./demoMode";
import { demoInstant } from "./startDemo";

describe("demo in-memory storage backend", () => {
  beforeEach(() => {
    enableInMemoryStorage();
  });

  it("round-trips a snapshot without touching IndexedDB", async () => {
    const snapshot = {
      alumno: DEMO_ALUMNO,
      avisos: DEMO_AVISOS,
      loadedAt: "2026-01-01T00:00:00.000Z",
    };
    await saveAppData(snapshot);
    await expect(loadAppData()).resolves.toEqual(snapshot);
  });

  it("clears every store on demand", async () => {
    await putValue(STORE_APP_DATA, { key: "scratch", value: 42 });
    await clearAllStores();
    await expect(getValue(STORE_APP_DATA, "scratch")).resolves.toBeUndefined();
  });
});

describe("demo data", () => {
  it("ships six invented subjects, only some graded", () => {
    expect(DEMO_ALUMNO.horario).toHaveLength(6);

    const graded = DEMO_ALUMNO.boleta.materias.filter(
      (materia) => materia.calificacion.trim() !== "",
    );
    expect(graded.length).toBeGreaterThan(0);
    expect(graded.length).toBeLessThan(DEMO_ALUMNO.boleta.materias.length);
  });

  it("routes every slot through the fictional 'Demo' room", () => {
    const meetings = mapHorario(DEMO_ALUMNO.horario, DEMO_ALUMNO.boleta);
    expect(meetings.length).toBeGreaterThan(0);
    for (const meeting of meetings) {
      expect(meeting.classroom).toBe("Demo");
    }
  });

  it("keeps the retícula map consistent with the semester matrix", () => {
    for (const semester of DEMO_ALUMNO.semestres) {
      for (const materia of semester) {
        expect(DEMO_ALUMNO.reticulaMap.get(materia.clave)).toBe(materia);
      }
    }
  });
});

describe("demoInstant", () => {
  it("stays on the same weekday when the morning is still ahead", () => {
    const instant = demoInstant(new Date("2026-10-15T09:00:00"));
    expect(instant.getDay()).toBe(4); // Thursday
    expect(instant.getHours()).toBe(10);
    expect(instant.getMinutes()).toBe(5);
  });

  it("rolls to the next day once 10:05 has passed", () => {
    const instant = demoInstant(new Date("2026-10-15T11:00:00"));
    expect(instant.getDay()).toBe(5); // Friday
  });

  it("skips the weekend", () => {
    const instant = demoInstant(new Date("2026-10-17T12:00:00"));
    expect(instant.getDay()).toBe(1); // Monday
  });
});

describe("isDemoMode", () => {
  it("reads the ?demo flag from the query string", () => {
    vi.stubGlobal("window", { location: { search: "?demo" } });
    expect(isDemoMode()).toBe(true);

    vi.stubGlobal("window", { location: { search: "?foo=bar" } });
    expect(isDemoMode()).toBe(false);

    vi.unstubAllGlobals();
  });
});
