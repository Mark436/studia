import { SithClient } from "sith-api-client";
import {
  SithAuthError,
  SithHttpError,
  SithNetworkError,
} from "sith-api-client";
import { ESTADO_MATERIA_RETICULA } from "sith-api-client";
import type {
  Alumno,
  Aviso,
  Boleta,
  CalificacionMateria,
  Coordenadas,
  Credenciales,
  DatosAlumno,
  ReticulaMateria,
} from "sith-api-client";

export { ESTADO_MATERIA_RETICULA };

export type {
  Alumno,
  Aviso,
  Boleta,
  CalificacionMateria,
  Coordenadas,
  Credenciales,
  DatosAlumno,
  ReticulaMateria,
};

export type ApiErrorKind = "invalid-credentials" | "connection" | "unknown";

const KIND_MESSAGES: Record<ApiErrorKind, string> = {
  "invalid-credentials": "Usuario o contraseña incorrectos.",
  connection: "No se pudo conectar con el servicio académico.",
  unknown: "Ocurrió un error inesperado.",
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, options?: ErrorOptions) {
    super(KIND_MESSAGES[kind], options);
    this.name = "ApiError";
    this.kind = kind;
  }
}

export interface SithApi {
  fetchDatos(credentials: Credenciales): Promise<DatosAlumno>;
}

class RealSithApiImpl implements SithApi {
  private client = (() => {
    const baseUrl = import.meta.env.VITE_API_URL?.trim();
    return baseUrl ? new SithClient({ baseUrl }) : new SithClient();
  })();

  async fetchDatos(credentials: Credenciales): Promise<DatosAlumno> {
    try {
      return await this.client.fetchDatos(credentials);
    } catch (error) {
      throw new ApiError(classifyError(error), { cause: error });
    }
  }
}

let defaultSithApi: SithApi = new RealSithApiImpl();

export function setDefaultSithApi(api: SithApi): void {
  defaultSithApi = api;
}

export async function fetchAppData(
  credentials: Credenciales,
  sithApi?: SithApi,
): Promise<DatosAlumno> {
  const api = sithApi ?? defaultSithApi;
  return api.fetchDatos(credentials);
}

function classifyError(error: unknown): ApiErrorKind {
  if (error instanceof SithAuthError) {
    return "invalid-credentials";
  }
  if (error instanceof SithNetworkError || error instanceof SithHttpError) {
    return "connection";
  }
  return "unknown";
}
