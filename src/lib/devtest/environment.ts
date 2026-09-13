import type { Aviso, Adeudos, Alumno } from "sith-api-client";
import type { CachedAppData } from "@/lib/storage/appDataStore";
import { loadAppData } from "@/lib/storage/appDataStore";
import type { SithApi, Clock, MockMateria } from "./interfaces";
import { SystemClock } from "./real/SystemClock";
import { FakeClock } from "./mock/FakeClock";
import { RealSithApi } from "./real/RealSithApi";
import { TestSithApi } from "./mock/TestSithApi";

// A simulated debt needs at least one readable area so the debts list reads
// naturally; a "clean" simulation clears every area.
function simulateAdeudos(adeudos: Adeudos, present: boolean): Adeudos {
  if (!present) {
    return {
      biblioteca: "",
      academico: "",
      escolar: "",
      financiero: "",
      administrativo: "",
      tieneAdeudos: false,
    };
  }
  return {
    ...adeudos,
    financiero: adeudos.financiero.trim() === "" ? "simulado" : adeudos.financiero,
    tieneAdeudos: true,
  };
}

class DevTestEnvironmentImpl {
  config: { sith: "real" | "mock" } = { sith: "real" };
  isActive = false;

  private mockAppData: CachedAppData | null = null;
  private systemClock: Clock;
  private fakeClock: FakeClock;
  private realSithApi: SithApi;
  private testSithApi: TestSithApi;
  private listeners = new Set<() => void>();

  private constructor() {
    this.systemClock = new SystemClock();
    this.fakeClock = new FakeClock();
    this.realSithApi = new RealSithApi();
    this.testSithApi = new TestSithApi(this);
  }

  static #instance: DevTestEnvironmentImpl | null = null;

  static getInstance(): DevTestEnvironmentImpl {
    if (!DevTestEnvironmentImpl.#instance) {
      DevTestEnvironmentImpl.#instance = new DevTestEnvironmentImpl();
    }
    return DevTestEnvironmentImpl.#instance;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  activate(): void {
    this.isActive = true;
    void this.loadMockStateFromCache();
  }

  deactivate(): void {
    this.isActive = false;
    this.config.sith = "real";
    this.mockAppData = null;
    this.fakeClock.setOffset(null);
    this.systemClock.setOffset(null);
    this.notify();
  }

  reset(): void {
    void this.loadMockStateFromCache();
  }

  private async loadMockStateFromCache(): Promise<void> {
    try {
      const cached = await loadAppData();
      if (cached) {
        this.mockAppData = cached;
        this.notify();
      }
    } catch {
      this.mockAppData = null;
    }
  }

  setSithMode(mode: "real" | "mock"): void {
    if (this.config.sith === mode) return;
    this.config.sith = mode;
    // Real mode always reads the system clock: never leave a shifted offset
    // behind when leaving the mock world.
    if (mode === "real") {
      this.systemClock.setOffset(null);
    }
    this.notify();
  }

  getMockAppData(): CachedAppData | null {
    return this.mockAppData;
  }

  setMockAppData(data: CachedAppData): void {
    this.mockAppData = data;
    this.notify();
  }

  updateGrade(clave: string, calificacion: string): void {
    if (!this.mockAppData) return;
    const materias = this.mockAppData.alumno.boleta.materias;
    const materiaIndex = materias.findIndex((m) => m.clave === clave);
    if (materiaIndex >= 0) {
      this.mockAppData = {
        ...this.mockAppData,
        alumno: {
          ...this.mockAppData.alumno,
          boleta: {
            ...this.mockAppData.alumno.boleta,
            materias: materias.map((materia, index) =>
              index === materiaIndex
                ? { ...materia, calificacion }
                : materia,
            ),
          },
        },
      };
      this.notify();
    }
  }

  addMateria(materia: MockMateria): void {
    if (!this.mockAppData) return;
    this.mockAppData = {
      ...this.mockAppData,
      alumno: {
        ...this.mockAppData.alumno,
        horario: [...this.mockAppData.alumno.horario, materia.horario],
        boleta: {
          ...this.mockAppData.alumno.boleta,
          materias: [...this.mockAppData.alumno.boleta.materias, materia.calificacion],
        },
      },
    };
    this.notify();
  }

  removeMateria(clave: string): void {
    if (!this.mockAppData) return;
    this.mockAppData = {
      ...this.mockAppData,
      alumno: {
        ...this.mockAppData.alumno,
        horario: this.mockAppData.alumno.horario.filter((m) => m.clave !== clave),
        boleta: {
          ...this.mockAppData.alumno.boleta,
          materias: this.mockAppData.alumno.boleta.materias.filter(
            (m) => m.clave !== clave,
          ),
        },
      },
    };
    this.notify();
  }

  addAviso(aviso: Aviso): void {
    if (!this.mockAppData) return;
    this.mockAppData = {
      ...this.mockAppData,
      avisos: [aviso, ...this.mockAppData.avisos],
    };
    this.notify();
  }

  setAdeudos(adeudos: Alumno["adeudos"]): void {
    if (!this.mockAppData) return;
    this.mockAppData = {
      ...this.mockAppData,
      alumno: { ...this.mockAppData.alumno, adeudos },
    };
    this.notify();
  }

  setAdeudosPresent(present: boolean): void {
    if (!this.mockAppData) return;
    this.mockAppData = {
      ...this.mockAppData,
      alumno: {
        ...this.mockAppData.alumno,
        adeudos: simulateAdeudos(this.mockAppData.alumno.adeudos, present),
      },
    };
    this.notify();
  }

  // Fuera (null) o una fecha futura: la app decide contra el reloj simulado.
  // Un string vacío equivale a "sin fecha" (parseReinscripcionDate).
  setMockReinscripcionDate(iso: string | null): void {
    if (!this.mockAppData) return;
    this.mockAppData = {
      ...this.mockAppData,
      alumno: {
        ...this.mockAppData.alumno,
        fechaReinscripcion: iso ?? "",
      },
    };
    this.notify();
  }

  getClock(): Clock {
    return this.config.sith === "mock" ? this.fakeClock : this.systemClock;
  }

  getSithApi(): SithApi {
    return this.config.sith === "mock" ? this.testSithApi : this.realSithApi;
  }
}

export const DevTestEnvironment = DevTestEnvironmentImpl.getInstance();