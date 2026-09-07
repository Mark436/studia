import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { Page } from "@/components/layout/Page";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SettingsIcon } from "@/components/ui/icons";
import type { ToastVariant } from "@/components/ui/toastVariants";
import { DevPanel } from "@/features/devtools/DevPanel";
import { DebtsCard } from "./components/DebtsCard";
import { ReinscripcionCard } from "./components/ReinscripcionCard";
import { UNLOCK_TAP_COUNT } from "@/features/devtools/config";
import type { DevToolsController } from "@/features/devtools/useDevConfig";
import type { Alumno } from "@/lib/api/client";

interface StudentPageProps {
  alumno: Alumno | null;
  onRequestRefresh: () => void;
  onShowToast?: (message: string, variant: ToastVariant) => void;
  onSendTestNotification?: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  dev?: DevToolsController;
}

export function StudentPage({
  alumno,
  onRequestRefresh,
  onShowToast,
  onSendTestNotification,
  onOpenSettings,
  onLogout,
  dev,
}: StudentPageProps) {
  const nameTapsRef = useRef(0);

  const devEnabled = dev !== undefined && dev.enabled;

  function handleNameTap() {
    if (!dev || devEnabled) return;

    nameTapsRef.current += 1;
    if (nameTapsRef.current >= UNLOCK_TAP_COUNT) {
      nameTapsRef.current = 0;
      dev.enable();
    }
  }

  return (
    <>
      <Page>
        {alumno ? (
          <>
            <Card className="flex flex-col items-center gap-1 py-6 text-center">
              <button
                type="button"
                onClick={handleNameTap}
                className="rounded-lg text-lg font-semibold text-on-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                {alumno.nombre}
              </button>
              <p className="text-sm text-on-surface-variant">{alumno.carrera}</p>
              <p className="text-xs text-on-surface-variant">
                Semestre {alumno.semestre}
              </p>
            </Card>

            {Number.isFinite(alumno.progreso) ? (
              <Card className="flex flex-col gap-3 py-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-on-surface">
                    Progreso de la carrera
                  </p>
                  <span className="flex items-baseline gap-0.5">
                    <AnimatedNumber
                      value={Math.round(alumno.progreso)}
                      className="font-display text-xl font-bold tabular-nums text-primary-strong"
                    />
                    <span className="text-sm font-bold text-primary-strong">
                      %
                    </span>
                  </span>
                </div>
                <ProgressBar
                  value={alumno.progreso}
                  label="Progreso de la carrera"
                />
              </Card>
            ) : null}

            <DebtsCard adeudos={alumno.adeudos} />

            <ReinscripcionCard alumno={alumno} />

            {devEnabled && dev ? (
              <DevPanel
                alumno={alumno}
                dev={dev}
                onShowToast={onShowToast}
                onSendTestNotification={onSendTestNotification}
              />
            ) : null}
          </>
        ) : (
          <Card className="py-8 text-center text-sm text-on-surface-variant">
            No hay datos del alumno disponibles.
          </Card>
        )}

        <Card className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SettingsIcon size={20} className="shrink-0 text-primary" />
            <p className="min-w-0 text-sm font-medium text-on-surface">
              Ajustes
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={onOpenSettings}
            className="shrink-0"
          >
            Personalizar
          </Button>
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface">
              Actualizar datos
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              También puedes deslizar hacia abajo en cualquier pantalla.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={onRequestRefresh}
            className="shrink-0"
          >
            Actualizar
          </Button>
        </Card>
        <Card className="p-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-error transition-colors hover:bg-error-container/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-error"
          >
            Cerrar sesión
          </button>
        </Card>
      </Page>
    </>
  );
}
