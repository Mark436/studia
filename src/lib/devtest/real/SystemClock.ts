import type { Clock } from "../interfaces";
import { getNow, subscribeToClock, setClockOffsetMinutes, getClockOffsetMinutes } from "@/lib/devtools/clock";

export class SystemClock implements Clock {
  getNow(): Date {
    return getNow();
  }

  subscribe(listener: () => void): () => void {
    return subscribeToClock(listener);
  }

  setOffset(minutes: number | null): void {
    setClockOffsetMinutes(minutes);
  }

  advance(minutes: number): void {
    const current = getClockOffsetMinutes() ?? 0;
    setClockOffsetMinutes(current + minutes);
  }

  setDate(date: Date): void {
    const offsetMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
    setClockOffsetMinutes(offsetMinutes);
  }
}