import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchConReintento, retrasoRetryAfter } from "./fetchConReintento";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retrasoRetryAfter", () => {
  test("interpreta segundos", () => {
    expect(retrasoRetryAfter("10")).toBe(10_000);
    expect(retrasoRetryAfter("0")).toBe(0);
  });

  test("interpreta una fecha HTTP", () => {
    const objetivo = new Date(Date.now() + 60_000);
    const retraso = retrasoRetryAfter(objetivo.toUTCString());
    expect(retraso).not.toBeNull();
    expect(retraso as number).toBeGreaterThan(59_800);
    expect(retraso as number).toBeLessThan(60_200);
  });

  test("devuelve null sin cabecera o con valor inválido", () => {
    expect(retrasoRetryAfter(null)).toBeNull();
    expect(retrasoRetryAfter("no-es-fecha")).toBeNull();
  });
});

describe("fetchConReintento", () => {
  const OK = () => new Response("ok", { status: 200 });
  const rateLimited = () =>
    new Response(null, { status: 429, headers: { "Retry-After": "0" } });

  test("devuelve la respuesta sin reintentar si no es 429", async () => {
    const fetch = vi.fn().mockResolvedValue(OK());
    vi.stubGlobal("fetch", fetch);

    const res = await fetchConReintento("https://api.marcosochoa.dev/ith/x.pdf");

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("reintenta tras un 429 y devuelve la respuesta final", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(OK());
    vi.stubGlobal("fetch", fetch);

    const res = await fetchConReintento("https://api.marcosochoa.dev/ith/x.pdf");

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("cede tras el máximo de intentos y devuelve el último 429", async () => {
    const fetch = vi.fn().mockResolvedValue(rateLimited());
    vi.stubGlobal("fetch", fetch);

    const res = await fetchConReintento("https://api.marcosochoa.dev/ith/x.pdf");

    expect(res.status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});