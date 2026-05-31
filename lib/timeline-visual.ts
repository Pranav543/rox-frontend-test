import type { AdMode } from "./types";

export const MODE_COLORS: Record<
  AdMode,
  { badge: string; track: string; border: string; text: string }
> = {
  static: {
    badge: "bg-green-200",
    track: "bg-green-300",
    border: "border-green-800",
    text: "text-green-900",
  },
  auto: {
    badge: "bg-blue-200",
    track: "bg-blue-300",
    border: "border-blue-800",
    text: "text-blue-900",
  },
  ab: {
    badge: "bg-orange-200",
    track: "bg-orange-300",
    border: "border-orange-800",
    text: "text-orange-900",
  },
};

export function generateWaveformBars(count: number, seed = 42): number[] {
  let s = seed;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 16807 + 0) % 2147483647;
    const r = (s % 1000) / 1000;
    bars.push(0.15 + r * 0.85);
  }
  return bars;
}
