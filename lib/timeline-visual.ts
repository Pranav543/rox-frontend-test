import type { AdMode } from "./types";

/** Mockup: Auto = green, Static = blue, A/B = orange */
export const MODE_COLORS: Record<
  AdMode,
  { badge: string; track: string; border: string; text: string; icon: string }
> = {
  auto: {
    badge: "bg-[#dcfce7]",
    track: "bg-[#4ade80]",
    border: "border-[#16a34a]",
    text: "text-[#166534]",
    icon: "A",
  },
  static: {
    badge: "bg-[#dbeafe]",
    track: "bg-[#60a5fa]",
    border: "border-[#2563eb]",
    text: "text-[#1e40af]",
    icon: "S",
  },
  ab: {
    badge: "bg-[#ffedd5]",
    track: "bg-[#fb923c]",
    border: "border-[#ea580c]",
    text: "text-[#9a3412]",
    icon: "A/B",
  },
};

/** Episode waveform lane — mockup lavender purple */
export const EPISODE_LANE = {
  bg: "bg-[#F0ABFC]",
  border: "border-[#e879f9]",
  bar: "bg-white/95",
};

export function generateWaveformBars(count: number, seed = 42): number[] {
  let s = seed;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 16807 + 0) % 2147483647;
    const r = (s % 1000) / 1000;
    bars.push(0.12 + r * 0.88);
  }
  return bars;
}
