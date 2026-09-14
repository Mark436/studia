import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EstadoBadge } from "./EstadoBadge";
import type { ReticulaMateria, ReticulaMap } from "@/lib/api/client";

interface MateriaCardProps {
  materia: ReticulaMateria;
  reticulaMap: ReticulaMap;
  mostrarRelaciones?: boolean;
}

function RelacionesChips({ label, claves, reticulaMap }: {
  label: string;
  claves: string[];
  reticulaMap: ReticulaMap;
}) {
  if (claves.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <span className="text-xs font-medium text-on-surface-variant">{label}:</span>
      {claves.map((clave) => {
        const m = reticulaMap.get(clave);
        return (
          <Badge
            key={clave}
            variant="neutral"
            className="text-[10px] px-1.5 py-0.5"
          >
            {m ? `${m.clave} ${m.nombre}` : clave}
          </Badge>
        );
      })}
    </div>
  );
}

export function MateriaCard({ materia, reticulaMap, mostrarRelaciones = true }: MateriaCardProps) {
  return (
    <Card className="flex flex-col gap-2 py-3 px-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm font-medium text-on-surface truncate">
            {materia.nombre}
          </p>
          <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">
            {materia.clave}
          </p>
        </div>
        <EstadoBadge codigoEstado={materia.codigoEstado} />
      </div>

      <div className="flex items-center gap-3 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="font-medium">Créditos:</span>
          <span>—</span>
        </span>
      </div>

      {mostrarRelaciones && (
        <>
          <RelacionesChips
            label="Antes"
            claves={materia.anteriores}
            reticulaMap={reticulaMap}
          />
          <RelacionesChips
            label="Después"
            claves={materia.siguientes}
            reticulaMap={reticulaMap}
          />
        </>
      )}
    </Card>
  );
}