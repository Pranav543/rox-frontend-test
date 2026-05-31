"use client";

import { Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  disabled?: boolean;
  disabledReason?: string;
};

export function ExportButton({ disabled, disabledReason }: Props) {
  const [ffmpegOk, setFfmpegOk] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const onExport = useCallback(async () => {
    setError(null);
    setExporting(true);
    try {
      const res = await fetch("/api/export", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        downloadUrl?: string;
        filename?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Export failed");
      }

      if (!data.downloadUrl) {
        throw new Error("No download URL returned");
      }

      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = data.filename ?? "vidpod-export.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  const blocked = disabled || exporting;

  const title =
    disabledReason ??
    (ffmpegOk === false
      ? "Install ffmpeg on the server to enable MP4 export"
      : undefined);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onExport()}
        disabled={blocked}
        title={title}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {exporting ? "Exporting…" : "Export MP4"}
      </button>
      {error ? (
        <p className="max-w-xs text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
