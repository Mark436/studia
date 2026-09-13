import { useDevTestEnvironment } from "@/lib/devtest/provider";

type AdeudoOption = { label: string; value: boolean };

const OPTIONS: ReadonlyArray<AdeudoOption> = [
  { label: "Con adeudo", value: true },
  { label: "Sin adeudo", value: false },
];

export function AdeudosSection() {
  const env = useDevTestEnvironment();
  const hasAdeudos = env.getMockAppData()?.alumno.adeudos.tieneAdeudos ?? false;

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Adeudos</h4>
      <div
        role="group"
        aria-label="Simular adeudos"
        className="flex gap-2"
      >
        {OPTIONS.map((option) => {
          const selected = hasAdeudos === option.value;
          return (
            <button
              key={option.label}
              type="button"
aria-pressed={selected}
          onClick={() => env.setAdeudosPresent(option.value)}
              className={`h-9 flex-1 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                selected
                  ? "bg-primary text-on-primary"
                  : "bg-primary-container/60 text-on-primary-container hover:bg-primary-container"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-on-surface-variant">
        Se aplica a los datos simulados; al hacer pull-to-refresh se muestra el
        mismo aviso que en producción si se entra en adeudo.
      </p>
    </section>
  );
}