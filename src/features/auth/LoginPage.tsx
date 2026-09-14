import { Card } from "@/components/ui/Card";
import { useAuth } from "./auth-context";
import { CredentialsForm } from "./components/CredentialsForm";

export function LoginPage() {
  const { rememberedUsername } = useAuth();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-icon-2xl w-icon-2xl items-center justify-center rounded-2xl bg-primary text-xl font-bold text-on-primary elevated"
          >
            S
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-background">
            Studia
          </h1>
        </header>

        <Card className="p-6">
          <CredentialsForm
            submitLabel="Iniciar sesión"
            initialUser={rememberedUsername ?? ""}
          />
        </Card>
      </div>
    </div>
  );
}
