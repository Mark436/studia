import type { Aviso, Alumno } from "@/lib/api/client";
import type { CachedAppData } from "@/lib/storage/appDataStore";
import { loadAppData } from "@/lib/storage/appDataStore";
import type { SithApi, Clock } from "./interfaces";
import { SystemClock } from "./real/SystemClock";
import { FakeClock } from "./mock/FakeClock";
import { RealSithApi } from "./real/RealSithApi";
import { TestSithApi } from "./mock/TestSithApi";

class DevTestEnvironmentImpl {
  config: { sith: "real" | "mock" } = { sith: "real" };
  isActive = false;

  private mockAppData: CachedAppData | null = null;
  private systemClock: Clock;
  private fakeClock: FakeClock;
  private realSithApi: SithApi;
  private testSithApi: TestSithApi;

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

  activate(): void {
    this.isActive = true;
    this.loadMockStateFromCache();
  }

  deactivate(): void {
    this.isActive = false;
    this.config.sith = "real";
    this.mockAppData = null;
    this.fakeClock.setOffset(null);
  }

  reset(): void {
    this.loadMockStateFromCache();
  }

  private async loadMockStateFromCache(): Promise<void> {
    try {
      const cached = await loadAppData();
      if (cached) {
        this.mockAppData = cached;
      }
    } catch {
      this.mockAppData = null;
    }
  }

  setSithMode(mode: "real" | "mock"): void {
    this.config.sith = mode;
  }

  getMockAppData(): CachedAppData | null {
    return this.mockAppData;
  }

  setMockAppData(data: CachedAppData): void {
    this.mockAppData = data;
  }

  updateGrade(clave: string, calificacion: string): void {
    if (!this.mockAppData) return;
    const materiaIndex = this.mockAppData.alumno.boleta.materias.findIndex(
      (m) => m.clave === clave
    );
    if (materiaIndex >= 0) {
      this.mockAppData.alumno.boleta.materias[materiaIndex] = {
        ...this.mockAppData.alumno.boleta.materias[materiaIndex],
        calificacion,
      };
    }
  }

  addAviso(aviso: Aviso): void {
    if (!this.mockAppData) return;
    this.mockAppData.avisos = [aviso, ...this.mockAppData.avisos];
  }

  setAdeudos(adeudos: Alumno["adeudos"]): void {
    if (!this.mockAppData) return;
    this.mockAppData.alumno.adeudos = adeudos;
  }

  getClock(): Clock {
    return this.config.sith === "mock" ? this.fakeClock : this.systemClock;
  }

  getSithApi(): SithApi {
    return this.config.sith === "mock" ? this.testSithApi : this.realSithApi;
  }
}

export const DevTestEnvironment = DevTestEnvironmentImpl.getInstance();