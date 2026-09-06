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
  Credenciales,
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

function createSithClient(): SithClient {
  const baseUrl = import.meta.env.VITE_API_URL?.trim();

  return baseUrl ? new SithClient({ baseUrl }) : new SithClient();
}

const sithClient = createSithClient();

export async function fetchAppData(
  credentials: Credenciales,
): Promise<DatosAlumno> {
  try {
    return await sithClient.fetchDatos(credentials);
  } catch (error) {
    throw new ApiError(classifyError(error), { cause: error });
  }
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
