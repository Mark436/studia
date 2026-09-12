import type { Clock } from "../interfaces";

export class FakeClock implements Clock {
  private offsetMs = 0;
  private listeners = new Set<() => void>();

  getNow(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setOffset(minutes: number | null): void {
    this.offsetMs = (minutes ?? 0) * 60_000;
    this.notify();
  }

  advance(minutes: number): void {
    this.offsetMs += minutes * 60_000;
    this.notify();
  }

  setDate(date: Date): void {
    this.offsetMs = date.getTime() - Date.now();
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}