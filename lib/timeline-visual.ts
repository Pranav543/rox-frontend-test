import type { AdMode } from "./types";

/** Mockup: Auto = mint green, Static = sky blue, A/B = peach orange */
export const MODE_COLORS: Record<
  AdMode,
  {
    badge: string;
    track: string;
    border: string;
    badgeBorder: string;
    text: string;
    grip: string;
    gripColor: string;
    icon: string;
  }
> = {
  auto: {
    badge: "bg-[#dcfce7]",
    track: "bg-[#86EFAC]",
    border: "border-black",
    badgeBorder: "border-[#166534]",
    text: "text-[#166534]",
    grip: "bg-[#166534]",
    gripColor: "#166534",
    icon: "A",
  },
  static: {
    badge: "bg-[#dbeafe]",
    track: "bg-[#93C5FD]",
    border: "border-black",
    badgeBorder: "border-[#1e40af]",
    text: "text-[#1e40af]",
    grip: "bg-[#1e40af]",
    gripColor: "#1e40af",
    icon: "S",
  },
  ab: {
    badge: "bg-[#ffedd5]",
    track: "bg-[#FDBA74]",
    border: "border-black",
    badgeBorder: "border-[#9a3412]",
    text: "text-[#9a3412]",
    grip: "bg-[#9a3412]",
    gripColor: "#9a3412",
    icon: "A/B",
  },
};

/** Episode waveform lane — mockup lavender purple */
export const EPISODE_LANE = {
  bg: "bg-[#F0ABFC]",
  bar: "bg-white",
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
