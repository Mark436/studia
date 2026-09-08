// Proxy hacia ith.mx para calendario y documentos (evita CORS en producción).
// Solo permite GET a rutas específicas; nunca registra cuerpos ni almacena nada.

const UPSTREAM_BASE_URL = "https://ith.mx";

const ALLOWED_PREFIXES = ["/calendario-escolar.html", "/documentos/"];

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
    return jsonResponse(
      { error: "Ruta no permitida." },
      403,
      request,
    );
  }

  try {
    const upstream = await fetch(`${UPSTREAM_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        "User-Agent": request.headers.get("user-agent") ?? "Studia/1.0",
        Accept:
          path.endsWith(".html")
            ? "text/html,application/xhtml+xml"
            : "application/pdf,*/*",
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("text/html");
    const isPdf = contentType.includes("application/pdf");

    const responseHeaders: Record<string, string> = {
      "Content-Type":
        upstream.headers.get("content-type") ??
        (isPdf ? "application/pdf" : isHtml ? "text/html" : "application/octet-stream"),
      ...corsHeaders(request),
    };

    if (!isHtml && !isPdf) {
      responseHeaders["Cache-Control"] = "public, max-age=3600";
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonResponse(
      { error: "No se pudo contactar el servicio del instituto." },
      502,
      request,
    );
  }
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