import { useState } from "react";
import { Page } from "@/components/layout/Page";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TreeIcon } from "@/components/ui/icons";
import type { Alumno } from "@/lib/api/client";
import { useReticula } from "./hooks/useReticula";
import { ReticulaCard } from "./components/ReticulaCard";
import { FiltroDropdown } from "./components/FiltroDropdown";
import type { FiltroReticula } from "./types";

const FILTRO_OPTIONS: readonly { value: FiltroReticula; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendientes", label: "Pendientes" },
  { value: "acreditadas", label: "Acreditadas" },
  { value: "cursando", label: "Cursando" },
] as const;

export function ReticulaPage({ alumno }: { alumno: Alumno | null }) {
  const semestresReticula = alumno?.semestres;
  const semestreAlumno = alumno?.semestre ?? 1;

  const {
    semestres,
    semestreActual,
    filtro,
    setFiltro,
    obtenerMateriasFiltradas,
  } = useReticula(semestresReticula, semestreAlumno);

  const [activeSemestre, setActiveSemestre] = useState<number | null>(null);

  const handleSemestreToggle = (numero: number) => {
    setActiveSemestre((prev) => (prev === numero ? null : numero));
  };

  const totalMaterias = semestres.reduce((acc, s) => acc + s.total, 0);
  const totalAcreditadas = semestres.reduce((acc, s) => acc + s.acreditadas, 0);

  if (totalMaterias === 0 || !alumno?.reticulaMap) {
    return (
      <Page>
        <Card className="py-12 text-center">
          <TreeIcon size={48} className="mx-auto mb-3 text-on-surface-variant/50" />
          <p className="text-on-surface-variant">No hay datos de retícula disponibles</p>
          <p className="text-xs text-on-surface-variant mt-1">
            La retícula aparecerá aquí tras sincronizar con el sistema académico.
          </p>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex items-center justify-end gap-2 mb-4">
        <Badge variant="neutral" className="text-xs">
          {totalAcreditadas} / {totalMaterias} materias
        </Badge>
        <FiltroDropdown
          value={filtro}
          onChange={setFiltro}
          options={FILTRO_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-3">
        {semestres
          .filter((s) => obtenerMateriasFiltradas(s.numero).length > 0)
          .map((semestre) => (
            <ReticulaCard
              key={semestre.numero}
              semestre={semestre}
              isActive={activeSemestre === semestre.numero || semestreActual === semestre.numero}
              onToggle={() => handleSemestreToggle(semestre.numero)}
              filtro={filtro}
              obtenerMateriasFiltradas={obtenerMateriasFiltradas}
              reticulaMap={alumno.reticulaMap}
            />
          ))}
      </div>
    </Page>
  );
}