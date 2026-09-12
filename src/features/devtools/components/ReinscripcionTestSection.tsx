import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useClock } from "@/lib/devtest/provider";
import type { Alumno } from "@/lib/api/client";
import {
  getTimeUntilReinscripcion,
  parseReinscripcionDate,
} from "@/lib/notifications/reinscripcion";

// Dev-only test affordance: exercise `getTimeUntilReinscripcion` against the
// student's real reinscription date across each timeline window.
type Scenario = "now" | "24h" | "30min" | "start" | "past" | "nodate";

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

const SCENARIOS: ReadonlyArray<readonly [Scenario, string]> = [
  ["now", "Ahora"],
  ["24h", "Faltan 24 h"],
  ["30min", "Faltan 30 min"],
  ["start", "Ya empezó"],
  ["past", "Ya pasó"],
  ["nodate", "Sin fecha"],
];

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ReinscripcionTestSection({
  alumno,
}: {
  alumno: Alumno | null;
}) {
  const clock = useClock();
  const [scenario, setScenario] = useState<Scenario>("now");

  const fecha = parseReinscripcionDate(alumno);
  const now = (() => {
    if (!fecha) return clock.getNow();
    const base = fecha.getTime();
    switch (scenario) {
      case "now":
        return clock.getNow();
      case "24h":
        return new Date(base - DIA_MS);
      case "30min":
        return new Date(base - 30 * MINUTO_MS);
      case "start":
        return new Date(base + MINUTO_MS);
      case "past":
        return new Date(base + 2 * DIA_MS);
      case "nodate":
        return clock.getNow();
    }
  })();

  const effective = scenario === "nodate" ? null : alumno;
  const result = getTimeUntilReinscripcion(effective, now);

  const summary =
    result.status === "no-date"
      ? "Sin fecha de reinscripción."
      : result.status === "past"
        ? `Pasó: ${DATE_FORMATTER.format(result.fecha)}`
        : result.status === "future"
          ? `Empieza en ${result.days}d ${result.hours}h ${result.minutes}m — ${DATE_FORMATTER.format(result.fecha)}`
          : `En curso desde hace ${result.days}d ${result.hours}h ${result.minutes}m — ${DATE_FORMATTER.format(result.fecha)}`;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-on-surface">Reinscripción</h4>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map(([value, label]) => (
          <Button
            key={value}
            variant={scenario === value ? "primary" : "secondary"}
            onClick={() => setScenario(value)}
            className="h-9 px-3 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-on-surface-variant tabular-nums">{summary}</p>
      <p className="text-xs text-on-surface-variant">
        Prueba el aviso futuro cruzando con el reloj simulado (Reloj → shift).
      </p>
    </section>
  );
}
