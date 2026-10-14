import { Card } from "@/components/ui/Card";
import { useAuth } from "./auth-context";
import { CredentialsForm } from "./components/CredentialsForm";

export function LoginPage() {
  const { rememberedUsername } = useAuth();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <Card className="p-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-background">
            Studia
          </h1>
          <CredentialsForm
            submitLabel="Iniciar sesión"
            initialUser={rememberedUsername ?? ""}
          />
        </Card>
      </div>
    </div>
  );
}
