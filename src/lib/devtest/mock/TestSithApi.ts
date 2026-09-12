import type { SithApi } from "../interfaces";
import type { Credenciales, DatosAlumno } from "@/lib/api/client";
import type { DevTestEnvironmentInterface } from "../interfaces";

export class TestSithApi implements SithApi {
  private env: DevTestEnvironmentInterface;

  constructor(env: DevTestEnvironmentInterface) {
    this.env = env;
  }

  async fetchDatos(_credentials: Credenciales): Promise<DatosAlumno> {
    const data = this.env.getMockAppData();
    if (!data) {
      throw new Error("Mock SithApi: No mock data available. Activate dev mode first.");
    }
    return { alumno: data.alumno, avisos: data.avisos };
  }
}