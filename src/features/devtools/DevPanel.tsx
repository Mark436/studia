import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ToastVariant } from "@/components/ui/toastVariants";
import type { Alumno } from "@/lib/api/client";
import type { NotificationDraft } from "@/lib/notifications/capsuleEvents";
import type { DevConfig } from "./types";
import { AdeudosSection } from "./components/AdeudosSection";
import { ClockSection } from "./components/ClockSection";
import { GradesSection } from "./components/GradesSection";
import { InteractionSection } from "./components/InteractionSection";
import { MateriasSection } from "./components/MateriasSection";
import { PruebaCompletaSection } from "./components/PruebaCompletaSection";
import { ReinscripcionTestSection } from "./components/ReinscripcionTestSection";
import { ToastsSection } from "./components/ToastsSection";
import type { DevToolsController } from "./useDevConfig";
import { useDevTestEnvironment } from "@/lib/devtest/provider";

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

  const simulating = hasActiveSimulation(dev.config);
  const sithMode = env.config.sith;
  const mockAlumno = env.getMockAppData()?.alumno ?? null;

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

      {/* API Mode Controls */}
      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-on-surface">API Mode</h4>
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

      {/* Mock Data Editor (only when Sith=mock) */}
      {sithMode === "mock" && mockAlumno && (
        <>
          <section className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-on-surface">Mock Alumno Data</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-on-surface-variant">Nombre</label>
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
                <label className="text-xs text-on-surface-variant">Número de control</label>
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
                <label className="text-xs text-on-surface-variant">Carrera</label>
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
                <label className="text-xs text-on-surface-variant">Semestre</label>
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
          <div className="border-t border-outline-variant pt-4" />

          <section className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-on-surface">Mock Grades</h4>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {mockAlumno.boleta.materias.map((materia: typeof mockAlumno.boleta.materias[0]) => (
                <div
                  key={materia.clave}
                  className="flex items-center gap-3 p-2 rounded-lg bg-surface"
                >
                  <span className="flex-1 min-w-0 text-sm text-on-surface truncate">
                    {materia.nombre}
                  </span>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {materia.calificacion || "—"}
                  </span>
                  <input
                    type="text"
                    value={materia.calificacion}
                    onChange={(e) => env.updateGrade(materia.clave, e.target.value)}
                    inputMode="numeric"
                    className="h-8 w-16 rounded-lg border border-outline bg-surface px-2 text-center text-sm tabular-nums text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                  />
                </div>
              ))}
            </div>
          </section>
          <div className="border-t border-outline-variant pt-4" />

          <section className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-on-surface">Mock Adeudos</h4>
            <div className="flex flex-col gap-2">
              {Object.entries(mockAlumno.adeudos)
                .filter(([key]) => key !== "tieneAdeudos")
                .map(([key, value]: [string, string]) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-2 rounded-lg bg-surface"
                  >
                    <label className="text-xs text-on-surface-variant capitalize w-24">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const newAdeudos = { ...mockAlumno.adeudos, [key]: e.target.value };
                        env.setAdeudos(newAdeudos as typeof mockAlumno.adeudos);
                      }}
                      className="flex-1 h-8 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                    />
                  </div>
                ))}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-surface">
                <label className="text-xs text-on-surface-variant w-24">tieneAdeudos</label>
                <input
                  type="checkbox"
                  checked={mockAlumno.adeudos.tieneAdeudos}
                  onChange={(e) => {
                    const newAdeudos = { ...mockAlumno.adeudos, tieneAdeudos: e.target.checked };
                    env.setAdeudos(newAdeudos as typeof mockAlumno.adeudos);
                  }}
                />
              </div>
            </div>
          </section>
          <div className="border-t border-outline-variant pt-4" />

          <section className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-on-surface">Mock Avisos</h4>
            <button
              type="button"
              onClick={() => env.addAviso({
                titulo: "Aviso de prueba",
                mensaje: "Este es un aviso simulado desde el modo dev",
                tipo: "info",
              })}
              className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-medium"
            >
              Agregar aviso de prueba
            </button>
          </section>
          <div className="border-t border-outline-variant pt-4" />
        </>
      )}

      <MateriasSection alumno={alumno} dev={dev} />
      <div className="border-t border-outline-variant pt-4" />
      <GradesSection alumno={alumno} dev={dev} onShowToast={onShowToast} />
      <div className="border-t border-outline-variant pt-4" />
      <AdeudosSection dev={dev} onShowToast={onShowToast} />
      <div className="border-t border-outline-variant pt-4" />
      <ReinscripcionTestSection alumno={alumno} />
      <div className="border-t border-outline-variant pt-4" />
      <PruebaCompletaSection alumno={alumno} />
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
