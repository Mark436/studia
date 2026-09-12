import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DevTestEnvironment } from "./environment";
import type { SithApi, Clock, DevTestEnvironmentInterface } from "./interfaces";

interface DevTestContextValue {
  sithApi: SithApi;
  clock: Clock;
  environment: DevTestEnvironmentInterface;
}

const DevTestContext = createContext<DevTestContextValue | null>(null);

export function DevTestProvider({ children }: { children: ReactNode }) {
  const env = DevTestEnvironment;
  const [sithApi] = useState(() => env.getSithApi());
  const [clock] = useState(() => env.getClock());

  useEffect(() => {
    const unsubSith = () => {
      // SithApi doesn't have subscriptions, but we could add if needed
    };
    const unsubClock = clock.subscribe(() => {
      // Clock changes trigger re-renders via components using useClock
    });
    return () => {
      unsubSith();
      unsubClock();
    };
  }, [clock]);

  return (
    <DevTestContext.Provider value={{ sithApi, clock, environment: env }}>
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
  return context.clock;
}

export function useDevTestEnvironment() {
  const context = useContext(DevTestContext);
  if (!context) {
    throw new Error("useDevTestEnvironment must be used within DevTestProvider");
  }
  return context.environment;
}