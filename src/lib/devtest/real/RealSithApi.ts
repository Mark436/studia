import type { SithApi } from "../interfaces";
import type { Credenciales, DatosAlumno } from "@/lib/api/client";
import { fetchAppData as realFetchAppData } from "@/lib/api/client";

export class RealSithApi implements SithApi {
  async fetchDatos(credentials: Credenciales): Promise<DatosAlumno> {
    return realFetchAppData(credentials);
  }
}