// Fetch a los documentos del instituto (`api.marcosochoa.dev/ith`) con manejo
// de rate-limit. El espejo limita a 30 peticiones por usuario cada 10 segundos
// (HTTP 429); cada cliente tiene su propio presupuesto, así que lo único que
// hace falta es no reactivar al instante: ante un 429 se espera el `Retry-After`
// (o 10 s por defecto) y se re-intenta con un número acotado de intentos.

const INTENTOS_MAX = 3;

/** Espera por defecto cuando el 429 no trae `Retry-After` (la ventana del límite). */
const ESPERA_DEFECTO_MS = 10_000;

/** Interpreta `Retry-After`: segundos («10») o fecha HTTP («Thu, 01 Jan 2026 …»). */
export function retrasoRetryAfter(valor: string | null): number | null {
  if (!valor) return null;

  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos >= 0) {
    return segundos * 1000;
  }

  const fecha = new Date(valor);
  if (!Number.isNaN(fecha.getTime())) {
    return Math.max(0, fecha.getTime() - Date.now());
  }

  return null;
}

/**
 * Igual que `fetch`, pero ante una respuesta HTTP 429 (rate-limit) espera la
 * duración indicada por `Retry-After` (o 10 s) y re-intenta hasta
 * `intentosMax` intentos en total. Devuelve la última respuesta, 429 incluido,
 * si se agotan los intentos. Si no es 429, devuelve la respuesta tal cual.
 */
export async function fetchConReintento(
  url: string,
  intentosMax = INTENTOS_MAX,
): Promise<Response> {
  for (let intento = 0; ; intento++) {
    const response = await fetch(url);

    if (response.status !== 429 || intento >= intentosMax - 1) {
      return response;
    }

    const espera =
      retrasoRetryAfter(response.headers.get("retry-after")) ??
      ESPERA_DEFECTO_MS;
    await new Promise(resolve => setTimeout(resolve, espera));
  }
}