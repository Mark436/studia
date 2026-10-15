import { useState } from "react";
import type { ReactNode } from "react";
import { TopZoneContext } from "./topZoneContext";
import { APP_COLUMN_MAX_WIDTH } from "./appColumn";

interface TopZoneProviderProps {
  children: ReactNode;
  /** Rendered inside the floating zone (the persistent context capsule). */
  slot?: ReactNode;
}

export function TopZoneProvider({ children, slot }: TopZoneProviderProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  return (
    <TopZoneContext value={element}>
      {children}
      {/* Flex row: the capsule sits at the start while collapsed and can
          center itself when expanded. Fixed so the capsule stays pinned to
          the viewport and never scrolls away with the page — but capped to the
          app's content column (`inset-x-3` + `mx-auto` + the shared max width),
          so on a wide screen it hovers over the centered column instead of
          spanning the whole screen. This box stays the capsule's anchor: the
          capsule measures it (`parent.clientWidth`) to center when expanded. */}
      <div
        ref={setElement}
        aria-hidden={element === null}
        className={`pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-30 mx-auto flex justify-start ${APP_COLUMN_MAX_WIDTH}`}
      >
        {slot}
      </div>
    </TopZoneContext>
  );
}
