// Proxy hacia ith.mx para calendario y documentos (evita CORS en producción).
// Solo permite GET a rutas específicas; nunca registra cuerpos ni almacena nada.

const UPSTREAM_BASE_URL = "https://ith.mx";

const ALLOWED_PREFIXES = ["/calendario-escolar.html", "/documentos/"];

const UPSTREAM_TIMEOUT_MS = 8_000;

const CACHE_TTL_MS = {
  "/calendario-escolar.html": 60 * 60 * 1000,
  "/documentos/": 10 * 60 * 1000,
} as const;

interface CacheEntry {
  status: number;
  headers: Record<string, string>;
  body: ArrayBuffer;
  expiresAt: number;
}

const cached = new Map<string, CacheEntry>();

export const config = { path: "/api/ith/:path*" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Método no permitido. Solo GET." },
      405,
      request,
    );
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/ith/, "");

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return jsonResponse({ error: "Ruta no permitida." }, 403, request);
  }

  const ttlKey = Object.keys(CACHE_TTL_MS).find((prefix) =>
    path.startsWith(prefix),
  ) as keyof typeof CACHE_TTL_MS | undefined;

  // Caché en memoria de respuestas HTML pequeñas (calendario / listado).
  const cacheKey = `${path}${url.search}`;
  const entry = ttlKey === undefined ? undefined : cached.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return new Response(entry.body, {
      status: entry.status,
      headers: { ...entry.headers, ...corsHeaders(request) },
    });
  }

  // `url.search` importa: el listado de Apache se ordena con `?C=M;O=D` y ese
  // orden es la clave para desempatar entre candidatos de la misma carrera.
  const upstream = await fetchUpstream(
    `${UPSTREAM_BASE_URL}${path}${url.search}`,
    {
      "User-Agent": request.headers.get("user-agent") ?? "Studia/1.0",
      Accept: path.endsWith(".html")
        ? "text/html,application/xhtml+xml"
        : "application/pdf,*/*",
    },
  );

  const contentType = upstream.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  const isPdf = contentType.includes("application/pdf");

  const responseHeaders: Record<string, string> = {
    "Content-Type":
      upstream.headers.get("content-type") ??
      (isPdf
        ? "application/pdf"
        : isHtml
          ? "text/html"
          : "application/octet-stream"),
    ...corsHeaders(request),
  };

  if (upstream.ok) {
    responseHeaders["Cache-Control"] =
      isHtml || isPdf
        ? "public, max-age=300, stale-while-revalidate=3600"
        : "public, max-age=3600";
  }

  if (upstream.ok && isHtml && ttlKey !== undefined) {
    const buffer = await upstream.arrayBuffer();
    cached.set(cacheKey, {
      status: upstream.status,
      headers: responseHeaders,
      body: buffer,
      expiresAt: Date.now() + CACHE_TTL_MS[ttlKey],
    });
    return new Response(buffer, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function fetchUpstream(
  upstreamUrl: string,
  headers: Record<string, string>,
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      return await fetch(upstreamUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } catch {
      if (attempt === 1) {
        return new Response(
          "El servicio del instituto no respondió a tiempo.",
          {
            status: 504,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("unreachable");
}

function corsHeaders(request: Request): Record<string, string> {
  const configured = process.env.CORS_ALLOW_ORIGIN?.trim();
  const origin = configured || request.headers.get("origin") || "*";

  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  request: Request,
): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(request),
  });
}
