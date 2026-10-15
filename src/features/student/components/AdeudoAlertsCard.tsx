import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Alumno } from "@/lib/api/client";
import { useAdeudoAlertsOptIn } from "@/lib/notifications/useAdeudoAlertsOptIn";

interface AdeudoAlertsCardProps {
  alumno: Alumno | null;
}

export function AdeudoAlertsCard({ alumno }: AdeudoAlertsCardProps) {
  const { state, enable, decline } = useAdeudoAlertsOptIn();

  if (state !== "unset" || !alumno) return null;

  return (
    <Card className="mx-4 mt-4 flex flex-col gap-4 p-5 shadow-xl ring-1 ring-outline-variant/70 sm:flex-col sm:items-stretch">
      <div className="flex-1">
        <p className="text-sm font-semibold text-on-surface">
          Alertas de adeudos
        </p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          Te avisamos en cuanto aparezca un adeudo nuevo.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={enable} className="w-full sm:w-auto">
          Activar
        </Button>
        <Button variant="ghost" onClick={decline} className="w-full sm:w-auto">
          No, gracias
        </Button>
      </div>
    </Card>
  );
}
