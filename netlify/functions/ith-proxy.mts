export const config = { path: "/api/ith/:path*" };

export default async function handler(request: Request): Promise<Response> {
  return Response.json({
    ok: true,
    message: "La Function está viva",
    method: request.method,
    pathname: new URL(request.url).pathname,
  });
}