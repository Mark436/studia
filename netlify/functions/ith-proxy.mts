export const config = { path: "/api/ith/:path*" };

export default async function handler(request: Request): Promise<Response> {
  try {
    const response = await fetch("https://ith.mx/calendario-escolar.html");

    return Response.json({
      ok: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      location: response.headers.get("location"),
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.name : String(error),
      message: error instanceof Error ? error.message : String(error),
      cause:
        error instanceof Error && error.cause
          ? String(error.cause)
          : undefined,
    }, { status: 502 });
  }
}