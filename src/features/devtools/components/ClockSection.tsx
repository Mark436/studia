import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useClock } from "@/lib/devtest/provider";
import type { DevToolsController } from "../useDevConfig";

const QUICK_OFFSETS: ReadonlyArray<readonly [label: string, minutes: number]> = [
  ["-1 h", -60],
  ["+15 min", 15],
  ["+1 h", 60],
  ["+1 día", 1440],
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatNow(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function ClockSection({ dev }: { dev: DevToolsController }) {
  const clock = useClock();
  const now = clock.getNow();
  const simulated = dev.config.clockOffsetMinutes !== null;

  function shiftOffset(deltaMinutes: number) {
    dev.updateConfig((previous) => ({
      ...previous,
      clockOffsetMinutes: (previous.clockOffsetMinutes ?? 0) + deltaMinutes,
    }));
  }

  function setAbsoluteTarget(target: string) {
    const targetMs = new Date(target).getTime();
    if (Number.isNaN(targetMs)) return;

    dev.updateConfig((previous) => ({
      ...previous,
      clockOffsetMinutes: Math.round((targetMs - clock.getNow().getTime()) / 60_000),
    }));
  }

  function resetClock() {
    dev.updateConfig((previous) => ({
      ...previous,
      clockOffsetMinutes: null,
    }));
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-on-surface">Reloj</h4>
        <span className="text-xs text-on-surface-variant tabular-nums">
          {formatNow(now)}
          {simulated ? " · simulado" : ""}
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        {QUICK_OFFSETS.map(([label, minutes]) => (
          <Button
            key={label}
            variant="secondary"
            onClick={() => shiftOffset(minutes)}
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
        onChange={(event) => setAbsoluteTarget(event.target.value)}
      />

      {simulated ? (
        <Button variant="ghost" onClick={resetClock} className="h-9 text-xs">
          Volver a la hora real
        </Button>
      ) : null}
    </section>
  );
}
