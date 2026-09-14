import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useDevTestEnvironment } from "@/lib/devtest/provider";
import type { Aviso } from "sith-api-client";

const TIPO_OPTIONS: ReadonlyArray<readonly [value: Aviso["tipo"], label: string]> = [
  ["info", "Info"],
  ["warn", "Advertencia"],
  ["error", "Error"],
];

const EMPTY_AVISO: Aviso = { titulo: "", mensaje: "", tipo: "info" };

function badgeVariantForTipo(tipo: Aviso["tipo"]): "neutral" | "warning" | "error" {
  switch (tipo) {
    case "warn":
      return "warning";
    case "error":
      return "error";
    default:
      return "neutral";
  }
}

export function AvisosSection() {
  const env = useDevTestEnvironment();
  const [draft, setDraft] = useState<Aviso>(EMPTY_AVISO);
  const [error, setError] = useState<string | null>(null);

  const avisos = env.getMockAppData()?.avisos ?? [];

  function addAviso() {
    if (draft.titulo.trim() === "") {
      setError("El aviso necesita un título.");
      return;
    }
    if (draft.mensaje.trim() === "") {
      setError("El aviso necesita un mensaje.");
      return;
    }
    env.addAviso({ ...draft });
    setDraft(EMPTY_AVISO);
    setError(null);
  }

  function handleRemove(aviso: Aviso) {
    env.removeAviso(aviso.titulo, aviso.mensaje);
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Avisos</h4>

      {avisos.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {avisos.map((aviso, index) => (
            <li
              key={`${aviso.titulo}-${aviso.mensaje}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-outline-variant"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={badgeVariantForTipo(aviso.tipo)} className="shrink-0">
                    {aviso.tipo.toUpperCase()}
                  </Badge>
                  <p className="truncate text-sm font-medium text-on-surface">
                    {aviso.titulo}
                  </p>
                </div>
                <p className="truncate text-xs text-on-surface-variant mt-0.5">
                  {aviso.mensaje}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => handleRemove(aviso)}
                className="h-8 shrink-0 px-2 text-xs"
                aria-label={`Quitar aviso: ${aviso.titulo}`}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No hay avisos simulados.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
        <Input
          label="Título"
          value={draft.titulo}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, titulo: event.target.value }))
          }
        />
        <Input
          label="Mensaje"
          value={draft.mensaje}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, mensaje: event.target.value }))
          }
        />
        <div className="flex flex-col gap-2">
          <SegmentedControl
            label="Tipo"
            value={draft.tipo}
            onChange={(value) =>
              setDraft((previous) => ({ ...previous, tipo: value as Aviso["tipo"] }))
            }
            options={TIPO_OPTIONS.map(([value, label]) => ({ value, label }))}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}

        <Button variant="secondary" onClick={addAviso} className="mt-1 w-full">
          Agregar aviso
        </Button>
        <p className="text-xs text-on-surface-variant">
          Se aplica a los datos simulados; al hacer pull-to-refresh se actualiza
          la lista de avisos.
        </p>
      </div>
    </section>
  );
}