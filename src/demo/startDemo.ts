// Boots the `?demo` showcase. Invoked from main.tsx via a dynamic import, so
// none of this ships in the real app's initial bundle. It is fully in-memory
// and stateless across reloads:
//
//   1. swap IndexedDB for an ephemeral in-memory backend (additive in db.ts);
//   2. put the dev-test environment in mock mode;
//   3. hand it the invented snapshot and seed the (in-memory) cache so the
//      auth restore finds an authenticated session with no network access;
//   4. pin the simulated clock to a weekday during class hours so the schedule
//      and the context capsule look alive.

import { DevTestEnvironment } from "@/lib/devtest/environment";
import { saveAppData } from "@/lib/storage/appDataStore";
import { enableInMemoryStorage } from "@/lib/storage/db";
import {
  SETTING_LAST_LOGIN_AT,
  setSetting,
} from "@/lib/storage/settingsStore";
import { DEMO_ALUMNO, DEMO_AVISOS } from "./data";

/** Nearest weekday at 10:05 (today if still ahead, otherwise the next one). */
export function demoInstant(now: Date = new Date()): Date {
  const target = new Date(now);
  target.setHours(10, 5, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export async function startDemo(): Promise<void> {
  enableInMemoryStorage();

  const loadedAt = new Date().toISOString();
  const snapshot = { alumno: DEMO_ALUMNO, avisos: DEMO_AVISOS, loadedAt };

  DevTestEnvironment.setSithMode("mock");
  DevTestEnvironment.setMockAppData(snapshot);
  DevTestEnvironment.getClock().setDate(demoInstant());

  // Seed the in-memory cache so AuthProvider restores this session without
  // touching the network. Marking the login as "just now" also keeps the
  // stale-session nudge from firing on entry (it would fight the demo's own
  // welcome toast).
  await saveAppData(snapshot);
  await setSetting(SETTING_LAST_LOGIN_AT, loadedAt);
}
