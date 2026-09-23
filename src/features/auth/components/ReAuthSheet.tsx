import { CredentialsForm } from "./CredentialsForm";

interface ReAuthSheetProps {
  open: boolean;
  /** Remembered control number to prefill the form. */
  initialUser?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReAuthSheet({
  open,
  initialUser = "",
  onClose,
  onSuccess,
}: ReAuthSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-on-background/40 backdrop-blur-[2px] motion-safe:animate-[studia-fade-in_0.25s_ease-out]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Volver a iniciar sesión"
        className="relative w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg ring-1 ring-outline-variant motion-safe:animate-[studia-sheet-in_0.35s_var(--ease-glide)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" />
        <h2 className="text-lg font-semibold text-on-surface">
          Vuelve a iniciar sesión
        </h2>
        <p className="mb-4 mt-1 text-sm text-on-surface-variant">
          Por seguridad tu contraseña no se guarda. Ingrésala para actualizar
          tus datos.
        </p>
        <CredentialsForm
          submitLabel="Actualizar datos"
          initialUser={initialUser}
          autoFocusPassword
          onSuccess={onSuccess}
        />
      </section>
    </div>
  );
}
