import { Badge } from "@/components/ui/Badge";
import { ESTADO_MATERIA_LABELS, ESTADO_MATERIA_VARIANT } from "../types";

interface EstadoBadgeProps {
  codigoEstado: number;
  className?: string;
}

export function EstadoBadge({ codigoEstado, className }: EstadoBadgeProps) {
  const label = ESTADO_MATERIA_LABELS[codigoEstado] ?? `Estado ${codigoEstado}`;
  const variant = ESTADO_MATERIA_VARIANT[codigoEstado] ?? "neutral";

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}