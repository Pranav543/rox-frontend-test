import type { AdMode } from "./types";

const MODES: AdMode[] = ["static", "auto", "ab"];

export function cycleMode(mode: AdMode): AdMode {
  const i = MODES.indexOf(mode);
  return MODES[(i + 1) % MODES.length];
}

export function adIdsForModeSwitch(mode: AdMode, current: string[]): string[] {
  if (mode === "static") return current.length > 0 ? [current[0]] : [];
  return current;
}
