import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { TopZoneProvider } from "./TopZone";
import { usePullToRefresh } from "./usePullToRefresh";

const TRIGGER_THRESHOLD_PX = 64;

/** Reserved band above the content for the floating context capsule. */
export type TopSpace = "full" | "half" | "none";

const TOP_SPACE_HEIGHT: Record<TopSpace, string> = {
  full: "h-[calc(env(safe-area-inset-top)+58px)]",
  half: "h-[calc(env(safe-area-inset-top)+29px)]",
  // "none": content starts at the island's own top (safe + 10px). The Page
  // already adds pt-2 (8px), so 2px lands the top row centered with the 48px
  // collapsed island.
  none: "h-[calc(env(safe-area-inset-top)+2px)]",
};

interface AppShellProps {
  navigation?: ReactNode;
  onPullToRefresh?: () => unknown;
  /** Rendered inside the floating top zone (persistent context capsule). */
  topSlot?: ReactNode;
  /** Reserved capsule band height. "none" lets a screen's own top row sit
      beside the collapsed island. Defaults to "full". */
  topSpace?: TopSpace;
  children: ReactNode;
}

export function AppShell({
  navigation,
  onPullToRefresh,
  topSlot,
  topSpace = "full",
  children,
}: AppShellProps) {
  const { offset, refreshing, dragging, bind } = usePullToRefresh(onPullToRefresh);
  const progress = Math.min(offset / TRIGGER_THRESHOLD_PX, 1);
  const showIndicator = offset > 0 || refreshing;

  return (
    <div className="min-h-dvh bg-background">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col">
        {/* Reserved island space: a constant height keeps the layout stable
            while the capsule expands over the content. Screens whose top row
            sits beside the island use "none" (safe area only). */}
        <div
          aria-hidden="true"
          className={`shrink-0 ${TOP_SPACE_HEIGHT[topSpace]}`}
        />
        <TopZoneProvider slot={topSlot}>
          {showIndicator ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center"
              style={{ opacity: refreshing ? 1 : progress }}
            >
              <Spinner size={24} className="text-primary" />
            </div>
          ) : null}
          <main className="flex flex-1 flex-col">
            <div
              {...bind}
              className={`flex flex-1 flex-col ${
                dragging ? undefined : "transition-transform duration-200 ease-out"
              }`}
              style={{ transform: `translateY(${offset}px)` }}
            >
              {children}
              {navigation ? <div aria-hidden="true" className="h-20" /> : null}
            </div>
          </main>
        </TopZoneProvider>
      </div>
      {navigation ? <div className="sticky bottom-0 z-40">{navigation}</div> : null}
    </div>
  );
}
