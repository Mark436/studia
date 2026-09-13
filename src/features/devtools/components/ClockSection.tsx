import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useClock, useDevTestEnvironment } from "@/lib/devtest/provider";
import { formatDateTimeShort, toLocalInputValue } from "../dateTime";

const QUICK_OFFSETS: ReadonlyArray<readonly [label: string, minutes: number]> = [
  ["-1 h", -60],
  ["+15 min", 15],
  ["+1 h", 60],
  ["+1 día", 1440],
];

export function ClockSection() {
  const env = useDevTestEnvironment();
  const clock = useClock();
  // Re-render as soon as the (fake) clock changes so the label and controls
  // follow the shift instead of waiting for the next panel re-render.
  const [, setTick] = useState(0);
  useEffect(() => clock.subscribe(() => setTick((value) => value + 1)), [clock]);
  const now = clock.getNow();
  const mockActive = env.config.sith === "mock";
  const shifted = mockActive && now.getTime() !== Date.now();

  if (!mockActive) {
    return (
      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-on-surface">Reloj</h4>
        <p className="text-xs text-on-surface-variant">
          Con la API en Real no hay reloj simulado: inicia sesión de modo dev
          con la API Mock para poder adelantar la hora.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-on-surface">Reloj</h4>
        <span className="text-xs text-on-surface-variant tabular-nums">
          {formatDateTimeShort(now)}
          {shifted ? " · simulado" : ""}
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        {QUICK_OFFSETS.map(([label, minutes]) => (
          <Button
            key={label}
            variant="secondary"
            onClick={() => clock.advance(minutes)}
            className="h-9 px-3 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      <Input
        label="Fecha y hora exactas"
        type="datetime-local"
        value={toLocalInputValue(now)}
        onChange={(event) => {
          const target = new Date(event.target.value);
          if (Number.isNaN(target.getTime())) return;
          clock.setDate(target);
        }}
      />

      {shifted ? (
        <Button
          variant="ghost"
          onClick={() => clock.setOffset(null)}
          className="h-9 text-xs"
        >
          Volver a la hora real
        </Button>
      ) : null}
    </section>
  );
}