"use client";

import { formatTime } from "@/lib/format-time";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { RefObject, useCallback, useRef, useState } from "react";

type VideoPlayerProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  playing: boolean;
  episodeTime: number;
  episodeDuration: number;
  episodeReady: boolean;
  episodeLoading?: boolean;
  timelineTime: number;
  totalDuration: number;
  inAd: boolean;
  onTogglePlay: () => void;
  onSkip: (delta: number) => void;
  onSeek: (t: number) => void;
};

export function VideoPlayer({
  videoRef,
  playing,
  episodeTime,
  episodeDuration,
  episodeReady,
  episodeLoading = false,
  timelineTime,
  totalDuration,
  inAd,
  onTogglePlay,
  onSkip,
  onSeek,
}: VideoPlayerProps) {
  const [dragging, setDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const pct = totalDuration > 0 ? (timelineTime / totalDuration) * 100 : 0;

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = sliderRef.current;
      if (!el || totalDuration <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    seekFromClientX(e.clientX);
  };

  const onPointerUp = () => setDragging(false);

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="relative flex-1 overflow-hidden rounded-t-2xl bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          onClick={onTogglePlay}
        />
        {(!episodeReady || episodeLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <p className="text-sm font-medium">
              {episodeLoading ? "Loading video…" : "Upload a main video to get started"}
            </p>
          </div>
        )}
        {inAd && episodeReady && (
          <span className="absolute left-3 top-3 rounded bg-orange-500/90 px-2 py-1 text-xs font-medium text-white">
            Ad break
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-zinc-200 px-5 py-4">
        <button
          type="button"
          onClick={() => onSkip(-10)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 hover:bg-zinc-50"
          aria-label="Back 10 seconds"
          title="Back 10 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 hover:bg-zinc-50"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
        </button>

        <button
          type="button"
          onClick={() => onSkip(10)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 hover:bg-zinc-50"
          aria-label="Forward 10 seconds"
          title="Forward 10 seconds"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <div
          ref={sliderRef}
          className="relative mx-2 h-2 flex-1 cursor-pointer rounded-full bg-zinc-200"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={totalDuration}
          aria-valuenow={timelineTime}
          aria-label="Playback position"
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-zinc-800"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-300 bg-white shadow"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="shrink-0 text-right font-mono text-sm tabular-nums text-zinc-600">
          <div>
            {formatTime(timelineTime)}
            {totalDuration > 0 ? ` / ${formatTime(totalDuration)}` : ""}
          </div>
          <div className="text-xs text-zinc-400">
            Episode {formatTime(episodeTime)}
            {episodeDuration > 0 ? ` / ${formatTime(episodeDuration)}` : ""}
            {!episodeReady ? " · loading…" : inAd ? " · ad" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
