"use client";

import { ChevronLeft } from "lucide-react";

type Props = {
  episodeFilename: string | null;
};

function episodeTitle(filename: string | null): string {
  if (!filename) return "Upload an episode to get started";
  const base = filename.split("/").pop()?.replace(/\.[^.]+$/, "") ?? filename;
  const pretty = base.replace(/-/g, " ").replace(/_/g, " ");
  if (pretty.length > 20) {
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }
  return "The Longevity Expert: The Truth About Ozempic, The Magic Weight Loss Drug & The Link Between Milk & Cancer!";
}

function episodeMeta(filename: string | null): string {
  if (!filename) return "No episode loaded";
  const base = filename.split("/").pop() ?? "";
  const num = base.match(/\d+/)?.[0] ?? "503";
  return `Episode ${num} • 12 April 2024`;
}

export function EpisodeHeader({ episodeFilename }: Props) {
  return (
    <div className="mb-2 shrink-0">
      <button
        type="button"
        className="mb-1.5 flex items-center gap-1 text-[13px] text-[#6b7280] transition hover:text-[#111827]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Ads
      </button>
      <h1 className="line-clamp-2 max-w-[720px] text-[17px] font-semibold leading-snug tracking-tight text-[#111827]">
        {episodeTitle(episodeFilename)}
      </h1>
      <p className="mt-0.5 text-[13px] text-[#6b7280]">{episodeMeta(episodeFilename)}</p>
    </div>
  );
}
