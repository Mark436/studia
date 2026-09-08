import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ToastVariant } from "@/components/ui/toastVariants";
import type { Alumno } from "@/lib/api/client";
import type { DevConfig } from "./types";
import { AdeudosSection } from "./components/AdeudosSection";
import { ClockSection } from "./components/ClockSection";
import { GradesSection } from "./components/GradesSection";
import { InteractionSection } from "./components/InteractionSection";
import { MateriasSection } from "./components/MateriasSection";
import { ToastsSection } from "./components/ToastsSection";
import type { DevToolsController } from "./useDevConfig";

function hasActiveSimulation(config: DevConfig): boolean {
  return (
    config.clockOffsetMinutes !== null ||
    config.extraMaterias.length > 0 ||
    config.removedClaves.length > 0 ||
    Object.keys(config.gradeOverrides).length > 0 ||
    config.adeudoOverride !== null
  );
}

interface DevPanelProps {
  alumno: Alumno | null;
  dev: DevToolsController;
  onShowToast?: (message: string, variant: ToastVariant) => void;
  onSendTestNotification?: () => void;
}

export function DevPanel({
  alumno,
  dev,
  onShowToast,
  onSendTestNotification,
}: DevPanelProps) {
  if (!dev.loaded) return null;

  const simulating = hasActiveSimulation(dev.config);

  return (
    <Card className="flex flex-col gap-5 ring-primary/40">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-on-surface">Modo dev</h3>
        <Badge variant={simulating ? "primary" : "neutral"}>
          {simulating ? "Simulación activa" : "Inactivo"}
        </Badge>
      </header>

      <ClockSection dev={dev} />
      <div className="border-t border-outline-variant pt-4" />
      <MateriasSection alumno={alumno} dev={dev} />
      <div className="border-t border-outline-variant pt-4" />
      <GradesSection alumno={alumno} dev={dev} onShowToast={onShowToast} />
      <div className="border-t border-outline-variant pt-4" />
      <AdeudosSection dev={dev} onShowToast={onShowToast} />
      <div className="border-t border-outline-variant pt-4" />
      <InteractionSection
        onSendTestNotification={onSendTestNotification}
      />
      <div className="border-t border-outline-variant pt-4" />
      <ToastsSection dev={dev} onShowToast={onShowToast} />

      <div className="flex flex-col gap-2 border-t border-outline-variant pt-4">
        {simulating ? (
          <Button
            variant="secondary"
            onClick={dev.resetConfig}
            className="w-full"
          >
            Restaurar datos reales
          </Button>
        ) : null}
        <Button variant="ghost" onClick={dev.disable} className="w-full">
          Cerrar modo dev
        </Button>
      </div>
    </Card>
  );
}
