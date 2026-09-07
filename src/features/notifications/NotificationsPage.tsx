import { Card } from "@/components/ui/Card";
import { Page } from "@/components/layout/Page";
import type { Alumno } from "@/lib/api/client";
import { useAdeudoAlertsOptIn } from "@/lib/notifications/useAdeudoAlertsOptIn";
import { ReinscripcionCard } from "@/features/student/components/ReinscripcionCard";

interface NotificationsPageProps {
  alumno: Alumno | null;
}

export function NotificationsPage({ alumno }: NotificationsPageProps) {
  const adeudo = useAdeudoAlertsOptIn();

  return (
    <Page>
      <ReinscripcionCard alumno={alumno} />

      {adeudo.state !== "unset" ? (
        <Card className="flex flex-col gap-1 py-4">
          <p className="text-sm font-medium text-on-surface">
            Alertas de adeudos
          </p>
          <p className="text-xs text-on-surface-variant">
            {adeudo.state === "enabled"
              ? "Activadas: te avisamos en cuanto aparezca un adeudo nuevo."
              : "Desactivadas: no recibirás avisos de adeudos."}
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-1 py-4">
        <p className="text-sm font-medium text-on-surface">Avisos</p>
        <p className="text-xs text-on-surface-variant">
          Aquí se muestran tus avisos importantes: reinscripción, adeudos y
          progreso de carrera.
        </p>
      </Card>
    </Page>
  );
}
