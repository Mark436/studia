import type {
  Aviso,
  Alumno,
  CalificacionMateria,
  Credenciales,
  DatosAlumno,
  HorarioMateria,
} from "sith-api-client";

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

export interface MockMateria {
  horario: HorarioMateria;
  calificacion: CalificacionMateria;
}

export interface DevTestEnvironmentInterface {
  config: { sith: "real" | "mock" };
  isActive: boolean;
  subscribe(listener: () => void): () => void;
  activate(): void;
  deactivate(): void;
  reset(): void;
  setSithMode(mode: "real" | "mock"): void;
  getMockAppData(): { alumno: Alumno; avisos: Aviso[]; loadedAt: string } | null;
  setMockAppData(data: { alumno: Alumno; avisos: Aviso[]; loadedAt: string }): void;
  updateGrade(clave: string, calificacion: string): void;
  addMateria(materia: MockMateria): void;
  removeMateria(clave: string): void;
  addAviso(aviso: Aviso): void;
  setAdeudos(adeudos: Alumno["adeudos"]): void;
  setAdeudosPresent(present: boolean): void;
  setMockReinscripcionDate(iso: string | null): void;
  getClock(): Clock;
  getSithApi(): SithApi;
}