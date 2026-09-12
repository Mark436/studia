import { useEffect, useState } from "react";
import { useClock } from "@/lib/devtest/provider";

export const MINUTE_MS = 60_000;

// Timers can fire a few milliseconds off their deadline; below this floor a
// retry costs nothing and prevents skipping a whole cycle when a timeout
// lands just before its boundary.
const RETRY_FLOOR_MS = 250;

// A single reopen (or bfcache restore) can burst visibilitychange + pageshow
// + focus; this coalesces them into exactly one foreground resync.
const FOREGROUND_RESYNC_COOLDOWN_MS = 500;

// Exact wait until the next real minute boundary: at 10:34:48 the answer is
// 12_000 ms. Derived from the clock itself so cycles land on :00 seconds and
// never accumulate drift like fixed intervals do.
export function msUntilNextMinute(now: Date): number {
  return MINUTE_MS - (now.getTime() % MINUTE_MS);
}

function isSameMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

export function useCurrentTime(): Date {
  const clock = useClock();
  const [now, setNow] = useState(() => clock.getNow());

  useEffect(() => {
    let timeoutId: number | undefined;
    let lastForegroundResyncAt = 0;

    function evaluate() {
      setNow((previous) => {
        const current = clock.getNow();
        return isSameMinute(previous, current) ? previous : current;
      });
    }

    function clearTimer() {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }

    function arm() {
      const delay = Math.max(msUntilNextMinute(clock.getNow()), RETRY_FLOOR_MS);
      timeoutId = window.setTimeout(() => {
        evaluate();
        arm();
      }, delay);
    }

    // Foreground return: always refresh (no minute guard), because countdowns
    // must resync on every reopen even when the restart lands inside the same
    // minute, then re-arm the boundary timer.
    function resync() {
      clearTimer();
      setNow(clock.getNow());
      arm();
    }

    // Restarting re-derives everything from the real clock: used on mount,
    // on foreground return and on dev-clock shifts, never trusting stale
    // timing state from before the app was backgrounded.
    function start() {
      clearTimer();
      evaluate();
      arm();
    }

    function stop() {
      clearTimer();
    }

    // visibilitychange is the primary signal; pageshow covers bfcache
    // restores and focus covers tab/PWA foregrounding where the visibility
    // transition does not fire. All share the cooldown.
    function handleForeground() {
      if (document.hidden) return;
      const nowMs = performance.now();
      if (nowMs - lastForegroundResyncAt < FOREGROUND_RESYNC_COOLDOWN_MS) {
        return;
      }
      lastForegroundResyncAt = nowMs;
      resync();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        handleForeground();
      }
    }

    function handlePageShow() {
      handleForeground();
    }

    function handleWindowFocus() {
      handleForeground();
    }

    start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleWindowFocus);

    // Clock changes (dev simulation) apply immediately, even in background,
    // and resynchronize the next boundary to the shifted time.
    const unsubscribe = clock.subscribe(start);

    return () => {
      stop();
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [clock]);

  return now;
}