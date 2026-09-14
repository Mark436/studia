import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MateriaCard } from "./MateriaCard";
import type { ReticulaMateria, ReticulaMap } from "@/lib/api/client";
import type { SemestreReticula, FiltroReticula } from "../types";
import { CheckCircleIcon } from "@/components/ui/icons";

interface ReticulaCardProps {
  semestre: SemestreReticula;
  isActive: boolean;
  onToggle: () => void;
  filtro: FiltroReticula;
  obtenerMateriasFiltradas: (semestre: number) => ReticulaMateria[];
  reticulaMap: ReticulaMap;
}

export function ReticulaCard({
  semestre,
  isActive,
  onToggle,
  filtro,
  obtenerMateriasFiltradas,
  reticulaMap,
}: ReticulaCardProps) {
  const estaFiltrando = filtro !== "todas";
  const [isOpen, setIsOpen] = useState(
    !semestre.estaCompleto || isActive || estaFiltrando,
  );

  useEffect(() => {
    setIsOpen(!semestre.estaCompleto || isActive || estaFiltrando);
  }, [estaFiltrando, isActive, semestre.estaCompleto]);

  const materiasFiltradas = obtenerMateriasFiltradas(semestre.numero);

  const handleClick = () => {
    setIsOpen((prev) => !prev);
    onToggle();
  };

  return (
    <Card className="flex flex-col gap-2 overflow-hidden">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-between gap-3 w-full px-1 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-sans text-sm font-medium text-on-surface truncate">
              Semestre {semestre.numero}
            </span>
            {semestre.estaCompleto && semestre.total > 0 && (
              <CheckCircleIcon size={16} className="shrink-0 text-green-600" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {estaFiltrando && !semestre.estaCompleto && (
            <Badge variant="neutral" className="text-[10px]">
              {materiasFiltradas.length} / {semestre.total}
            </Badge>
          )}
          <span className="text-[11px] text-on-surface-variant">
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2 px-1 pb-2 border-t border-outline-variant mt-1">
          {materiasFiltradas.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-4">
              {filtro === "todas"
                ? "Sin materias en este semestre"
                : `Sin materias con filtro: ${filtro}`}
            </p>
          ) : (
            materiasFiltradas.map((materia) => (
              <MateriaCard
                key={materia.clave}
                materia={materia}
                reticulaMap={reticulaMap}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}