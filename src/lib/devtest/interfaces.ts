import type { Credenciales, DatosAlumno, Alumno, Aviso } from "@/lib/api/client";

export interface SithApi {
  fetchDatos(credentials: Credenciales): Promise<DatosAlumno>;
}

export interface Clock {
  getNow(): Date;
  subscribe(listener: () => void): () => void;
  setOffset(minutes: number | null): void;
  advance(minutes: number): void;
  setDate(date: Date): void;
}

export interface DevTestEnvironmentInterface {
  config: { sith: "real" | "mock" };
  isActive: boolean;
  activate(): void;
  deactivate(): void;
  reset(): void;
  setSithMode(mode: "real" | "mock"): void;
  getMockAppData(): { alumno: Alumno; avisos: Aviso[]; loadedAt: string } | null;
  setMockAppData(data: { alumno: Alumno; avisos: Aviso[]; loadedAt: string }): void;
  updateGrade(clave: string, calificacion: string): void;
  addAviso(aviso: Aviso): void;
  setAdeudos(adeudos: Alumno["adeudos"]): void;
  getClock(): Clock;
  getSithApi(): SithApi;
}