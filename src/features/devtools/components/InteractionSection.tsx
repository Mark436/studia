import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { NotificationDraft } from "@/lib/notifications/capsuleEvents";

// Dev-only test affordance: compose a custom alert (title + detail +
// conclusion) and fire it through the capsule (regardless of the selected
// channel), optionally plus a real system push — so the flash and the push
// expansion can be exercised without waiting for a real fetch change.
export function InteractionSection({
  onSendTestNotification,
}: {
  onSendTestNotification?: (
    draft: NotificationDraft,
    withSystemPush: boolean,
  ) => void;
}) {
  const [title, setTitle] = useState("Notificación de prueba");
  const [detail, setDetail] = useState("");
  const [conclusion, setConclusion] = useState("Canal de cápsula funcionando");
  const [withSystemPush, setWithSystemPush] = useState(true);

  if (!onSendTestNotification) return null;

  const canSend = title.trim() !== "";

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Notificaciones</h4>
      <Input
        label="Título"
        value={title}
        placeholder="Qué pasó"
        onChange={(event) => setTitle(event.target.value)}
      />
      <Input
        label="Detalle (se ve al expandir)"
        value={detail}
        placeholder="El dato concreto"
        onChange={(event) => setDetail(event.target.value)}
      />
      <Input
        label="Conclusión (colapsada)"
        value={conclusion}
        placeholder="La consecuencia o resumen"
        onChange={(event) => setConclusion(event.target.value)}
      />
      <Switch
        label="Incluir push del sistema"
        description="Además del aviso en la cápsula."
        checked={withSystemPush}
        onChange={setWithSystemPush}
      />
      <Button
        variant="secondary"
        disabled={!canSend}
        onClick={() =>
          onSendTestNotification(
            {
              title: title.trim(),
              detail: detail.trim() || undefined,
              conclusion: conclusion.trim() || undefined,
            },
            withSystemPush,
          )
        }
        className="w-full"
      >
        Enviar notificación de prueba
      </Button>
      <p className="text-xs text-on-surface-variant">
        Siempre se muestra en la cápsula: título y conclusión plegados, y el
        detalle al expandir; el push del sistema usa el mismo contenido.
      </p>
    </section>
  );
}