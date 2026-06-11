"use client";

import { consumeExportStream } from "@/lib/export-stream";
import { formatTime } from "@/lib/format-time";
import { Check, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  disabledReason?: string;
};

const SUCCESS_DISMISS_MS = 10_000;

export function ExportButton({ disabled, disabledReason }: Props) {
  const [ffmpegOk, setFfmpegOk] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    filename: string;
    durationSec: number;
  } | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/export")
      .then((r) => r.json())
      .then((d: { ffmpegAvailable?: boolean }) => {
        if (!cancelled) setFfmpegOk(d.ffmpegAvailable !== false);
      })
      .catch(() => {
        if (!cancelled) setFfmpegOk(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const scheduleSuccessDismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setSuccess(null);
      dismissTimerRef.current = null;
    }, SUCCESS_DISMISS_MS);
  }, []);

  const onExport = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setProgress(0);
    setProgressStage("Starting export…");
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/export", { method: "POST" });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Export failed");
      }

      if (!contentType.includes("ndjson")) {
        throw new Error("Unexpected export response");
      }

      const result = await consumeExportStream(res, {
        onProgress: (event) => {
          setProgress(event.percent);
          setProgressStage(event.stage);
        },
      });

      const a = document.createElement("a");
      a.href = result.downloadUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setProgress(100);
      setProgressStage("Export complete");
      setSuccess({
        filename: result.filename,
        durationSec: result.durationSec,
      });
      scheduleSuccessDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
      setProgress(0);
      setProgressStage("");
    } finally {
      setExporting(false);
    }
  }, [scheduleSuccessDismiss]);

  const blocked = disabled || exporting;

  const title =
    disabledReason ??
    (ffmpegOk === false
      ? "Install ffmpeg on the server to enable MP4 export"
      : undefined);

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={() => void onExport()}
        disabled={blocked}
        title={title}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-medium text-[#374151] shadow-sm transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {exporting ? "Exporting…" : "Export MP4"}
      </button>

      {exporting ? (
        <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
            <span className="min-w-0 truncate">{progressStage || "Exporting…"}</span>
            <span className="shrink-0 tabular-nums font-medium">{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-zinc-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Export progress"
          >
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      ) : null}

      {success ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900"
          role="status"
          aria-live="polite"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
          <div className="min-w-0 text-left">
            <p className="font-medium">Export complete</p>
            <p className="mt-0.5 break-all text-green-800">{success.filename}</p>
            {success.durationSec > 0 ? (
              <p className="mt-0.5 text-green-700">
                Duration {formatTime(success.durationSec)} · download started
              </p>
            ) : (
              <p className="mt-0.5 text-green-700">Download started</p>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-center text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
