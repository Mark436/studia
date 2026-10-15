import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "@/app/App.tsx";
import { isDemoMode } from "@/demo/demoMode";
import "./index.css";

async function bootstrap() {
  if (isDemoMode()) {
    // Showcase mode: fully in-memory (see src/demo). No service worker is
    // installed, so a reload always starts the demo from a clean slate.
    const { startDemo } = await import("@/demo/startDemo");
    await startDemo();
  } else {
    registerSW({ immediate: true });
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
