import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DevTestEnvironment } from "./environment";
import type { SithApi, Clock, DevTestEnvironmentInterface } from "./interfaces";

interface DevTestContextValue {
  environment: DevTestEnvironmentInterface;
}

const DevTestContext = createContext<DevTestContextValue | null>(null);

export function DevTestProvider({ children }: { children: ReactNode }) {
  const env = DevTestEnvironment;
  const [, setVersion] = useState(0);

  // Re-render the subtree (and produce a new context value) on every
  // environment change: mode toggles, mock-data mutations, activate/reset.
  useEffect(() => env.subscribe(() => setVersion((value) => value + 1)), [env]);

  const value: DevTestContextValue = { environment: env };

  return (
    <DevTestContext.Provider value={value}>
      {children}
    </DevTestContext.Provider>
  );
}

export function useSithApi(): SithApi {
  const context = useContext(DevTestContext);
  if (!context) {
    throw new Error("useSithApi must be used within DevTestProvider");
  }
  return context.environment.getSithApi();
}

export function useClock(): Clock {
  const context = useContext(DevTestContext);
  if (!context) {
    throw new Error("useClock must be used within DevTestProvider");
  }
  return context.environment.getClock();
}

export function useDevTestEnvironment(): DevTestEnvironmentInterface {
  const context = useContext(DevTestContext);
  if (!context) {
    throw new Error("useDevTestEnvironment must be used within DevTestProvider");
  }
  return context.environment;
}