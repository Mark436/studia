import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useClock, useDevTestEnvironment } from "@/lib/devtest/provider";
import { getTimeUntilReinscripcion } from "@/lib/notifications/reinscripcion";
import { formatDateTimeShort, toLocalInputValue } from "../dateTime";

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

// Lapsos relativos al usuario (hora real): ponen la fecha de reinscripción de
// los datos mock en una ventana determinada. El aviso y la tarjeta se prueban
// cruzando ese momento con el reloj simulado + pull-to-refresh.
const PRESETS: ReadonlyArray<readonly [label: string, offsetMs: number | null]> =
  [
    ["Sin fecha", null],
    ["Ayer", -DIA_MS],
    ["En +30 min", 30 * MINUTO_MS],
    ["En +1 día", DIA_MS],
    ["En +1 semana", 7 * DIA_MS],
    ["En +2 semanas", 14 * DIA_MS],
  ];

export function ReinscripcionSection() {
  const env = useDevTestEnvironment();
  const clock = useClock();
  // Sigue al reloj simulado para que el estado y el resumen avancen al cruzar
  // la fecha, igual que la ReinscripcionCard real.
  const [, setTick] = useState(0);
  useEffect(() => clock.subscribe(() => setTick((value) => value + 1)), [clock]);

  const mockAlumno = env.getMockAppData()?.alumno ?? null;
  const iso = mockAlumno?.fechaReinscripcion?.trim() ?? "";
  const fecha = iso ? new Date(iso) : null;
  const validDate =
    fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
  const now = clock.getNow();

  const result = getTimeUntilReinscripcion(mockAlumno, now);
  const summary =
    result.status === "no-date"
      ? "Sin fecha de reinscripción."
      : result.status === "past"
        ? `Pasó: ${formatDateTimeShort(result.fecha)}`
        : result.status === "future"
          ? `Empieza en ${result.days}d ${result.hours}h ${result.minutes}m — ${formatDateTimeShort(result.fecha)}`
          : `En curso desde hace ${result.days}d ${result.hours}h ${result.minutes}m — ${formatDateTimeShort(result.fecha)}`;

  function applyPreset(offsetMs: number | null) {
    const target = offsetMs === null ? null : new Date(Date.now() + offsetMs);
    env.setMockReinscripcionDate(target ? target.toISOString() : null);
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Reinscripción</h4>

      <p className="text-xs text-on-surface-variant tabular-nums">{summary}</p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([label, offsetMs]) => (
          <Button
            key={label}
            variant="secondary"
            onClick={() => applyPreset(offsetMs)}
            className="h-9 px-3 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      <Input
        label="Fecha exacta"
        type="datetime-local"
        value={toLocalInputValue(validDate ?? now)}
        onChange={(event) => {
          if (event.target.value === "") {
            env.setMockReinscripcionDate(null);
            return;
          }
          const target = new Date(event.target.value);
          if (Number.isNaN(target.getTime())) return;
          env.setMockReinscripcionDate(target.toISOString());
        }}
      />

      <p className="text-xs text-on-surface-variant">
        Aplica al hacer pull-to-refresh: si la fecha es futura y cambió, la app
        suelta el mismo aviso que en producción (toast / notificación). Luego
        cruza el momento con el Reloj simulado para ver la tarjeta pasar a
        "En curso" / "Pasó". Cambia la fecha entre pruebas para que el aviso
        vuelva a disparar.
      </p>
    </section>
  );
}