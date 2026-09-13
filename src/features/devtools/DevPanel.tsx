import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ToastVariant } from "@/components/ui/toastVariants";
import type { Alumno } from "@/lib/api/client";
import type { NotificationDraft } from "@/lib/notifications/capsuleEvents";
import { useDevTestEnvironment } from "@/lib/devtest/provider";
import { AdeudosSection } from "./components/AdeudosSection";
import { ClockSection } from "./components/ClockSection";
import { GradesSection } from "./components/GradesSection";
import { InteractionSection } from "./components/InteractionSection";
import { MateriasSection } from "./components/MateriasSection";
import { PruebaCompletaSection } from "./components/PruebaCompletaSection";
import { ReinscripcionSection } from "./components/ReinscripcionSection";
import { ToastsSection } from "./components/ToastsSection";
import type { DevToolsController } from "./useDevConfig";

interface DevPanelProps {
  alumno: Alumno | null;
  dev: DevToolsController;
  onShowToast?: (message: string, variant: ToastVariant) => void;
  onSendTestNotification?: (
    draft: NotificationDraft,
    withSystemPush: boolean,
  ) => void;
}

export function DevPanel({
  alumno,
  dev,
  onShowToast,
  onSendTestNotification,
}: DevPanelProps) {
  const env = useDevTestEnvironment();
  if (!dev.loaded) return null;

  const sithMode = env.config.sith;
  const mockActive = sithMode === "mock";
  const mockAlumno = env.getMockAppData()?.alumno ?? null;

  return (
    <Card className="flex flex-col gap-5 ring-primary/40">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-on-surface">Modo dev</h3>
        <Badge variant={mockActive ? "primary" : "neutral"}>
          {mockActive ? "Simulación activa" : "Inactivo"}
        </Badge>
      </header>

      {/* API mode toggles: always at the top */}
      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-on-surface">API</h4>
        <SegmentedControl
          label="Sith API"
          value={sithMode}
          onChange={(mode) => env.setSithMode(mode as "real" | "mock")}
          options={[
            { value: "real", label: "Real" },
            { value: "mock", label: "Mock" },
          ]}
        />
      </section>
      <div className="border-t border-outline-variant pt-4" />

      {/* Mock data editing (only applies while Sith=Mock) */}
      {mockActive ? (
        <>
          <p className="text-xs text-on-surface-variant">
            Edita los datos simulados. El cambio aplica al hacer
            pull-to-refresh: la app vuelve a pedir los datos y detecta las
            diferencias (toast de calificaciones, adeudos, reinscripción,
            avisos). Solo el Reloj es instantáneo.
          </p>

          {mockAlumno ? (
            <section className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-on-surface">
                Datos del alumno
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-on-surface-variant">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={mockAlumno.nombre}
                    onChange={(e) => {
                      const newAlumno = { ...mockAlumno, nombre: e.target.value };
                      env.setMockAppData({ ...env.getMockAppData()!, alumno: newAlumno });
                    }}
                    className="h-9 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-on-surface-variant">
                    Número de control
                  </label>
                  <input
                    type="text"
                    value={mockAlumno.numeroControl}
                    onChange={(e) => {
                      const newAlumno = { ...mockAlumno, numeroControl: e.target.value };
                      env.setMockAppData({ ...env.getMockAppData()!, alumno: newAlumno });
                    }}
                    className="h-9 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-on-surface-variant">
                    Carrera
                  </label>
                  <input
                    type="text"
                    value={mockAlumno.carrera}
                    onChange={(e) => {
                      const newAlumno = { ...mockAlumno, carrera: e.target.value };
                      env.setMockAppData({ ...env.getMockAppData()!, alumno: newAlumno });
                    }}
                    className="h-9 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-on-surface-variant">
                    Semestre
                  </label>
                  <input
                    type="number"
                    value={mockAlumno.semestre}
                    onChange={(e) => {
                      const newAlumno = { ...mockAlumno, semestre: Number(e.target.value) };
                      env.setMockAppData({ ...env.getMockAppData()!, alumno: newAlumno });
                    }}
                    className="h-9 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                  />
                </div>
              </div>
            </section>
          ) : (
            <p className="text-xs text-on-surface-variant">
              No hay datos simulados cargados. Inicia sesión o haz un
              pull-to-refresh con la API en Real para sembrar el modo Mock.
            </p>
          )}

          <div className="border-t border-outline-variant pt-4" />

          <MateriasSection />
          <div className="border-t border-outline-variant pt-4" />
          <GradesSection />
          <div className="border-t border-outline-variant pt-4" />
          <AdeudosSection />
          <div className="border-t border-outline-variant pt-4" />
          <ReinscripcionSection />
          <div className="border-t border-outline-variant pt-4" />

          <section className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-on-surface">Avisos</h4>
            <Button
              variant="secondary"
              onClick={() =>
                env.addAviso({
                  titulo: "Aviso de prueba",
                  mensaje: "Este es un aviso simulado desde el modo dev",
                  tipo: "info",
                })
              }
              className="h-9 w-full"
            >
              Agregar aviso de prueba
            </Button>
          </section>
        </>
      ) : (
        <p className="text-xs text-on-surface-variant">
          Cambia la API a Mock para editar los datos simulados.
        </p>
      )}
      <div className="border-t border-outline-variant pt-4" />

      <ClockSection />
      <div className="border-t border-outline-variant pt-4" />

      <PruebaCompletaSection alumno={alumno} />
      <div className="border-t border-outline-variant pt-4" />
      <InteractionSection onSendTestNotification={onSendTestNotification} />
      <div className="border-t border-outline-variant pt-4" />
      <ToastsSection dev={dev} onShowToast={onShowToast} />

      <div className="flex flex-col gap-2 border-t border-outline-variant pt-4">
        {mockActive ? (
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