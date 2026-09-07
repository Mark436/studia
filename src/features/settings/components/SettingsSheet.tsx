import { Slider } from "@/components/ui/Slider";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { useAdeudoAlertsOptIn } from "@/lib/notifications/useAdeudoAlertsOptIn";
import { useRememberUsername } from "../useRememberUsername";
import { DEFAULT_CAPSULE_COLLAPSE_MS, DEFAULT_LONG_PRESS_MS } from "../types";
import type { NotificationChannel } from "../types";
import type { SettingsController } from "../useSettings";

const PRESS_MIN_MS = 200;
const PRESS_MAX_MS = 1500;
const PRESS_STEP_MS = 50;

const COLLAPSE_MIN_MS = 500;
const COLLAPSE_MAX_MS = 5000;
const COLLAPSE_STEP_MS = 250;

interface SettingsSheetProps {
  open: boolean;
  settings: SettingsController;
  onClose: () => void;
}

export function SettingsSheet({
  open,
  settings,
  onClose,
}: SettingsSheetProps) {
  const adeudo = useAdeudoAlertsOptIn();
  const rememberUsername = useRememberUsername();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-on-background/40 backdrop-blur-[2px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg ring-1 ring-outline-variant"
      >
        <div className="mx-auto mb-4 mt-3 h-1 w-10 shrink-0 rounded-full bg-outline-variant" />
        <div className="flex items-center justify-between px-5">
          <h2 className="text-lg font-semibold text-on-surface">Ajustes</h2>
        </div>
        <div className="mt-4 flex flex-col gap-6 overflow-y-auto px-5">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-on-surface">
              Notificaciones
            </h3>
            <Switch
              label="Alertas de adeudos"
              description="Te avisamos en cuanto aparezca un adeudo nuevo."
              checked={adeudo.state === "enabled"}
              disabled={adeudo.state === "loading"}
              onChange={(checked) =>
                checked ? adeudo.enable() : adeudo.decline()
              }
            />
            <SegmentedControl<NotificationChannel>
              label="Canal de avisos"
              options={[
                { value: "capsule", label: "Cápsula" },
                { value: "toast", label: "Toast" },
              ]}
              value={settings.settings.notificationChannel}
              onChange={(notificationChannel) =>
                settings.update((previous) => ({
                  ...previous,
                  notificationChannel,
                }))
              }
            />
            <p className="text-xs text-on-surface-variant">
              Define cómo se anuncian calificaciones nuevas, adeudos y
              progreso: la cápsula muestra el detalle y luego el promedio del
              periodo; el toast clásico aparece abajo.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-on-surface">Privacidad</h3>
            <Switch
              label="Recordar mi número de control"
              description="Prefiere tu número de control al iniciar sesión. La contraseña nunca se guarda."
              checked={rememberUsername.checked}
              disabled={rememberUsername.loading}
              onChange={rememberUsername.set}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-on-surface">Cápsula</h3>
            <Slider
              label="Colapso automático"
              min={COLLAPSE_MIN_MS}
              max={COLLAPSE_MAX_MS}
              step={COLLAPSE_STEP_MS}
              value={settings.settings.capsuleCollapseMs}
              displayValue={`${(settings.settings.capsuleCollapseMs / 1000).toFixed(2)} s`}
              onChange={(capsuleCollapseMs) =>
                settings.update((previous) => ({
                  ...previous,
                  capsuleCollapseMs,
                }))
              }
            />
            <p className="text-xs text-on-surface-variant">
              La cápsula se expande sola en cambios importantes y colapsa sola
              tras este tiempo. Referencia: {DEFAULT_CAPSULE_COLLAPSE_MS} ms.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-on-surface">
              Interacción
            </h3>
            <Slider
              label="Duración de presión larga"
              min={PRESS_MIN_MS}
              max={PRESS_MAX_MS}
              step={PRESS_STEP_MS}
              value={settings.settings.longPressDurationMs}
              displayValue={`${settings.settings.longPressDurationMs} ms`}
              onChange={(longPressDurationMs) =>
                settings.update((previous) => ({
                  ...previous,
                  longPressDurationMs,
                }))
              }
            />
            <p className="text-xs text-on-surface-variant">
              Mantén presionada una tarjeta de clase para editarla. Referencia:{" "}
              {DEFAULT_LONG_PRESS_MS} ms.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
