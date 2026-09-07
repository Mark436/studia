import { Card } from "@/components/ui/Card";
import type { Alumno } from "@/lib/api/client";
import { getNow } from "@/lib/devtools/clock";
import { getTimeUntilReinscripcion } from "@/lib/notifications/reinscripcion";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  hour: "numeric",
  minute: "2-digit",
});

function formatReinscripcionDate(fecha: Date): string {
  return `${DATE_FORMATTER.format(fecha)} a las ${TIME_FORMATTER.format(fecha)}`;
}

function formatRemaining(days: number, hours: number, minutes: number): string {
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ReinscripcionCard({ alumno }: { alumno: Alumno | null }) {
  const time = getTimeUntilReinscripcion(alumno, getNow());

  if (time.status === "no-date" || time.status === "past") return null;

  const dateLabel = formatReinscripcionDate(time.fecha);

  if (time.status === "active") {
    return (
      <Card className="flex flex-col gap-1 py-4">
        <p className="text-sm font-medium text-on-surface">
          Tu turno de reinscripción va en curso
        </p>
        <p className="text-xs text-on-surface-variant">
          Abre tu portafolio para completar la inscripción.{" "}
          <span className="tabular-nums">{dateLabel}</span>
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-1 py-4 ring-primary/30">
      <p className="text-sm font-medium text-on-surface">
        Tu turno de reinscripción
      </p>
      <p className="text-sm text-primary-strong">
        Empieza en{" "}
        <span className="font-semibold tabular-nums">
          {formatRemaining(time.days, time.hours, time.minutes)}
        </span>
      </p>
      <p className="text-xs text-on-surface-variant">
        <span className="tabular-nums">{dateLabel}</span>
      </p>
    </Card>
  );
}
