"use client";

import { type ReactNode, RefObject } from "react";

type VideoPlayerProps = {
  episodeVideoRef: RefObject<HTMLVideoElement | null>;
  adVideoRef: RefObject<HTMLVideoElement | null>;
  showingAd: boolean;
  playing: boolean;
  episodeReady: boolean;
  episodeLoading?: boolean;
  inAd: boolean;
  onTogglePlay: () => void;
  onSkip: (delta: number) => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
};

const LABEL = "text-[13px] font-normal leading-none text-[#666666]";
const ICON_DARK = "text-[#1a1a1a]";
const ICON_MUTED = "text-[#666666]";

function CircleJumpButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e0e0e0] bg-white ${ICON_DARK} transition hover:bg-[#fafafa] disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function IconJumpToStart() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden>
      <rect x="1.5" y="2" width="1.2" height="9" />
      <path d="M10.8 6.5L4.8 2.8v7.4L10.8 6.5z" />
    </svg>
  );
}

function IconJumpToEnd() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden>
      <path d="M2.2 6.5L8.2 2.8v7.4L2.2 6.5z" />
      <rect x="10.3" y="2" width="1.2" height="9" />
    </svg>
  );
}

function IconSkip10Back({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M9 5.25V9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M5.1 5.55A6.25 6.25 0 1 1 9 15.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M3.75 5.55L5.1 5.55L5.1 6.9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSkip10Forward({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M9 5.25V9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M12.9 5.55A6.25 6.25 0 1 0 9 15.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M14.25 5.55L12.9 5.55L12.9 6.9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRewind() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="currentColor" aria-hidden>
      <path d="M6.2 1.2L0.8 7l5.4 5.8V1.2z" />
      <path d="M12.8 1.2L7.4 7l5.4 5.8V1.2z" />
    </svg>
  );
}

function IconFastForward() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="currentColor" aria-hidden>
      <path d="M4.2 1.2L9.6 7 4.2 12.8V1.2z" />
      <path d="M10.8 1.2L16.2 7l-5.4 5.8V1.2z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="currentColor" aria-hidden>
      <path d="M9 6.5l10.5 6.5L9 19.5V6.5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden>
      <rect x="5" y="5" width="4.5" height="12" rx="0.5" />
      <rect x="12.5" y="5" width="4.5" height="12" rx="0.5" />
    </svg>
  );
}

function VideoControls({
  disabled,
  playing,
  onJumpToStart,
  onJumpToEnd,
  onSkip,
  onTogglePlay,
}: {
  disabled: boolean;
  playing: boolean;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onSkip: (delta: number) => void;
  onTogglePlay: () => void;
}) {
  return (
    <div className="mt-4 flex h-12 w-full shrink-0 items-center justify-between rounded-full border border-[#e0e0e0] bg-white px-6">
      <div className="flex shrink-0 items-center gap-2">
        <CircleJumpButton
          onClick={onJumpToStart}
          disabled={disabled}
          label="Jump to start"
        >
          <IconJumpToStart />
        </CircleJumpButton>
        <span className={`${LABEL} whitespace-nowrap`}>Jump to start</span>
      </div>

      <button
        type="button"
        onClick={() => onSkip(-10)}
        disabled={disabled}
        className={`flex shrink-0 items-center gap-1.5 transition hover:opacity-70 disabled:opacity-40 ${ICON_MUTED}`}
        aria-label="Back 10 seconds"
      >
        <IconSkip10Back />
        <span className={LABEL}>10s</span>
      </button>

      <div className="flex shrink-0 items-center gap-6">
        <button
          type="button"
          onClick={() => onSkip(-30)}
          disabled={disabled}
          className={`flex items-center justify-center transition hover:opacity-70 disabled:opacity-40 ${ICON_DARK}`}
          aria-label="Rewind"
        >
          <IconRewind />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          className={`flex items-center justify-center transition hover:opacity-70 disabled:opacity-40 ${ICON_DARK}`}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        <button
          type="button"
          onClick={() => onSkip(30)}
          disabled={disabled}
          className={`flex items-center justify-center transition hover:opacity-70 disabled:opacity-40 ${ICON_DARK}`}
          aria-label="Fast forward"
        >
          <IconFastForward />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onSkip(10)}
        disabled={disabled}
        className={`flex shrink-0 items-center gap-1.5 transition hover:opacity-70 disabled:opacity-40 ${ICON_MUTED}`}
        aria-label="Forward 10 seconds"
      >
        <span className={LABEL}>10s</span>
        <IconSkip10Forward />
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <span className={`${LABEL} whitespace-nowrap`}>Jump to end</span>
        <CircleJumpButton onClick={onJumpToEnd} disabled={disabled} label="Jump to end">
          <IconJumpToEnd />
        </CircleJumpButton>
      </div>
    </div>
  );
}

export function VideoPlayer({
  episodeVideoRef,
  adVideoRef,
  showingAd,
  playing,
  episodeReady,
  episodeLoading = false,
  inAd,
  onTogglePlay,
  onSkip,
  onJumpToStart,
  onJumpToEnd,
}: VideoPlayerProps) {
  const disabled = !episodeReady;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white p-[clamp(12px,1.2vw,20px)] shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#111827]">
        <video
          ref={episodeVideoRef}
          className={`absolute inset-0 h-full w-full object-cover ${
            showingAd ? "pointer-events-none opacity-0" : ""
          }`}
          muted={showingAd}
          playsInline
          preload="auto"
          loop={false}
          onClick={onTogglePlay}
        />
        <video
          ref={adVideoRef}
          className={`absolute inset-0 h-full w-full object-cover ${
            showingAd ? "" : "pointer-events-none opacity-0"
          }`}
          playsInline
          preload="auto"
          loop={false}
          onClick={onTogglePlay}
        />
        {(!episodeReady || episodeLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
            {episodeLoading ? "Loading video…" : "Upload a main video to get started"}
          </div>
        )}
        {inAd && episodeReady && (
          <span className="absolute left-3 top-3 rounded-md bg-[#ea580c]/90 px-2 py-0.5 text-[11px] font-medium text-white">
            Ad break
          </span>
        )}
      </div>

      <VideoControls
        disabled={disabled}
        playing={playing}
        onJumpToStart={onJumpToStart}
        onJumpToEnd={onJumpToEnd}
        onSkip={onSkip}
        onTogglePlay={onTogglePlay}
      />
    </div>
  );
}
