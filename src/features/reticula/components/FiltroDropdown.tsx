import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, ChevronDownIcon, FilterIcon } from "@/components/ui/icons";
import type { FiltroReticula } from "../types";

interface FiltroDropdownProps {
  value: FiltroReticula;
  onChange: (value: FiltroReticula) => void;
  options: readonly { value: FiltroReticula; label: string }[];
}

export function FiltroDropdown({ value, onChange, options }: FiltroDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const option = options.find((o) => o.value === value) ?? options[0];
  const hasFiltro = value !== "todas";

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Filtrar materias por estado: ${option.label}`}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.97] ${
          hasFiltro
            ? "bg-primary text-on-primary"
            : "bg-outline-variant/60 text-on-surface-variant hover:bg-outline-variant"
        }`}
      >
        <FilterIcon size={14} className="shrink-0" />
        <span className="truncate">{option.label}</span>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 min-w-[10rem] overflow-hidden rounded-[20px] bg-surface p-1 elevated ring-1 ring-outline-variant motion-safe:animate-[studia-fade-up_0.3s_var(--ease-out-soft)]"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-full px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                  selected
                    ? "bg-primary-container font-medium text-on-primary-container"
                    : "text-on-surface hover:bg-outline-variant/60"
                }`}
              >
                {o.label}
                {selected && <CheckCircleIcon size={16} className="text-primary-strong" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}