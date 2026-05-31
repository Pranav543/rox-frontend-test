"use client";

import { AdPickerModal } from "@/components/AdPickerModal";
import { Header } from "@/components/Header";
import { MarkerPanel } from "@/components/MarkerPanel";
import { Sidebar } from "@/components/Sidebar";
import { Timeline } from "@/components/Timeline";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useProbeDurations } from "@/hooks/useProbeDurations";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useVidpodPlayer } from "@/hooks/useVidpodPlayer";
import type { AdPerformance } from "@/lib/marker-config";
import { buildTimeline, episodeMarkerToTimeline } from "@/lib/playback";
import { getPlayheadLabels } from "@/lib/timeline-mapping";
import { syncMarkersToServer } from "@/lib/sync-markers";
import type { Ad, AdMarker, AdMode } from "@/lib/types";
import { adIdsForModeSwitch } from "@/lib/marker-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

const MODES: AdMode[] = ["static", "auto", "ab"];

export default function VidpodPage() {
  const {
    value: markers,
    set: setMarkers,
    undo: undoHistory,
    redo: redoHistory,
    canUndo,
    canRedo,
    reset: resetMarkers,
  } = useUndoRedo<AdMarker[]>([]);

  const markersRef = useRef(markers);
  markersRef.current = markers;
  const persistGenRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodeUrl, setEpisodeUrl] = useState<string | null>(null);
  const [episodeFilename, setEpisodeFilename] = useState<string | null>(null);
  const [podcastVideos, setPodcastVideos] = useState<{ filename: string; name: string }[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [performance, setPerformance] = useState<Record<string, AdPerformance>>({});
  const [adPickerMarkerId, setAdPickerMarkerId] = useState<string | null>(null);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const loadedRef = useRef(false);

  const { catalog: adsCatalog } = useProbeDurations(ads, episodeUrl);
  const player = useVidpodPlayer(
    markers,
    episodeUrl ?? "",
    adsCatalog,
    performance
  );

  const playhead = useMemo(
    () =>
      getPlayheadLabels(
        player.timelineTime,
        player.episodeDuration,
        player.segments
      ),
    [player.timelineTime, player.episodeDuration, player.segments]
  );

  const adPickerMarker = markers.find((m) => m.id === adPickerMarkerId);

  const loadPerformance = useCallback(async () => {
    const res = await fetch("/api/ad-performance");
    if (res.ok) setPerformance(await res.json());
  }, []);

  const applyEpisode = useCallback(
    (data: {
      filename: string | null;
      url: string | null;
      videos?: { filename: string; name: string }[];
    }) => {
      setEpisodeFilename(data.filename);
      setEpisodeUrl(data.url);
      if (data.videos) setPodcastVideos(data.videos);
    },
    []
  );

  const loadEpisode = useCallback(async () => {
    const res = await fetch("/api/episode");
    if (!res.ok) throw new Error("Failed to load episode");
    applyEpisode(await res.json());
  }, [applyEpisode]);

  const loadAds = useCallback(async () => {
    const res = await fetch("/api/ads");
    if (!res.ok) throw new Error("Failed to load ads");
    setAds(await res.json());
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    Promise.all([
      fetch("/api/markers").then((r) => {
        if (!r.ok) throw new Error("Failed to load markers");
        return r.json() as Promise<AdMarker[]>;
      }),
      loadEpisode(),
      loadAds(),
      loadPerformance(),
    ])
      .then(([markerData]) => resetMarkers(markerData))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [loadEpisode, loadAds, loadPerformance, resetMarkers]);

  useEffect(() => {
    const id = setInterval(() => void loadPerformance(), 2000);
    return () => clearInterval(id);
  }, [loadPerformance]);

  useEffect(() => {
    if (!episodeUrl) return;
    setEpisodeLoading(true);
  }, [episodeUrl]);

  useEffect(() => {
    if (player.episodeReady) setEpisodeLoading(false);
  }, [player.episodeReady]);

  useEffect(() => {
    const ep = player.episodeVideoRef.current;
    const ad = player.adVideoRef.current;
    if (ep) ep.volume = volume;
    if (ad) ad.volume = volume;
  }, [volume, player.episodeVideoRef, player.adVideoRef, player.episodeReady]);

  const persistMarker = useCallback(async (marker: AdMarker, gen: number) => {
    const res = await fetch(`/api/markers/${marker.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: marker.startTime,
        mode: marker.mode,
        adIds: marker.adIds,
      }),
    });
    if (gen !== persistGenRef.current) return;
    if (!res.ok) throw new Error("Failed to save marker");
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void syncMarkersToServer(markersRef.current);
    }, 150);
  }, []);

  const updateMarkers = useCallback(
    (updater: (prev: AdMarker[]) => AdMarker[], recordHistory = true) => {
      setMarkers((prev) => updater(prev), recordHistory);
    },
    [setMarkers]
  );

  const undo = useCallback(() => {
    persistGenRef.current += 1;
    flushSync(() => undoHistory());
    scheduleSync();
  }, [undoHistory, scheduleSync]);

  const redo = useCallback(() => {
    persistGenRef.current += 1;
    flushSync(() => redoHistory());
    scheduleSync();
  }, [redoHistory, scheduleSync]);

  const setEpisode = async (data: { filename: string; url: string }) => {
    setEpisodeLoading(true);
    applyEpisode(data);
    await loadEpisode();
  };

  const handleUploadEpisode = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/episode", { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed");
    await setEpisode(await res.json());
  };

  const handleSelectEpisode = async (filename: string) => {
    const res = await fetch("/api/episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    if (!res.ok) throw new Error("Failed to select episode");
    await setEpisode(await res.json());
  };

  const episodeTimeAtPlayhead = useCallback(() => {
    if (!player.episodeReady) return 0;
    const { segments } = buildTimeline(
      markers,
      player.episodeDuration,
      adsCatalog,
      performance
    );
    for (const seg of segments) {
      if (
        seg.type === "episode" &&
        player.timelineTime >= seg.timelineStart &&
        player.timelineTime < seg.timelineEnd
      ) {
        return seg.episodeStart + (player.timelineTime - seg.timelineStart);
      }
    }
    return Math.min(player.timelineTime, player.episodeDuration);
  }, [
    markers,
    player.episodeDuration,
    player.episodeReady,
    player.timelineTime,
    adsCatalog,
    performance,
  ]);

  const createMarkerAt = async (startTime: number, mode: AdMode) => {
    if (!player.episodeReady) return;

    const res = await fetch("/api/markers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime, mode, adIds: [] }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as AdMarker;
    let nextMarkers: AdMarker[] = [];
    flushSync(() => {
      updateMarkers((prev) => {
        nextMarkers = [...prev, created].sort((a, b) => a.startTime - b.startTime);
        return nextMarkers;
      });
    });
    markersRef.current = nextMarkers;
    setSelectedId(created.id);
    setAdPickerMarkerId(created.id);
    scheduleSync();

    const { segments } = buildTimeline(
      nextMarkers,
      player.episodeDuration,
      adsCatalog,
      performance
    );
    player.seek(episodeMarkerToTimeline(created.startTime, segments));
  };

  const handleAddMarker = () => void createMarkerAt(episodeTimeAtPlayhead(), "static");

  const handleRandomMarker = () => {
    if (!player.episodeReady) return;
    const dur = player.episodeDuration;
    const startTime = Math.max(5, Math.random() * Math.max(dur - 15, 10));
    const mode = MODES[Math.floor(Math.random() * MODES.length)];
    void createMarkerAt(startTime, mode);
  };

  const handleDelete = async (id: string) => {
    persistGenRef.current += 1;
    let nextMarkers: AdMarker[] = [];
    flushSync(() => {
      updateMarkers((prev) => {
        nextMarkers = prev.filter((m) => m.id !== id);
        return nextMarkers;
      });
    });
    markersRef.current = nextMarkers;
    if (selectedId === id) setSelectedId(null);
    if (adPickerMarkerId === id) setAdPickerMarkerId(null);
    await fetch(`/api/markers/${id}`, { method: "DELETE" });
    scheduleSync();
  };

  const handleSelectMarker = useCallback(
    (id: string) => {
      setSelectedId(id);
      const marker = markers.find((m) => m.id === id);
      if (!marker || !player.episodeReady) return;
      const { segments } = buildTimeline(
        markers,
        player.episodeDuration,
        adsCatalog,
        performance
      );
      player.seek(episodeMarkerToTimeline(marker.startTime, segments));
    },
    [markers, player, adsCatalog, performance]
  );

  const handleMarkerMove = async (id: string, startTime: number) => {
    let updated: AdMarker | undefined;
    let nextMarkers: AdMarker[] = [];
    flushSync(() => {
      updateMarkers((prev) => {
        nextMarkers = prev
          .map((m) => (m.id === id ? { ...m, startTime } : m))
          .sort((a, b) => a.startTime - b.startTime);
        updated = nextMarkers.find((m) => m.id === id);
        return nextMarkers;
      });
    });
    markersRef.current = nextMarkers;
    if (updated && player.episodeReady) {
      void persistMarker(updated, persistGenRef.current);
      const { segments } = buildTimeline(
        nextMarkers,
        player.episodeDuration,
        adsCatalog,
        performance
      );
      player.seek(episodeMarkerToTimeline(startTime, segments));
    }
  };

  const handleModeChange = async (id: string, mode: AdMode) => {
    let updated: AdMarker | undefined;
    updateMarkers((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id) return m;
        return { ...m, mode, adIds: adIdsForModeSwitch(mode, m.adIds) };
      });
      updated = next.find((m) => m.id === id);
      return next;
    });
    if (updated) await persistMarker(updated, persistGenRef.current);
  };

  const handleAdIdsSave = async (adIds: string[]) => {
    if (!adPickerMarker) return;
    const normalized =
      adPickerMarker.mode === "static"
        ? adIds.length > 0
          ? [adIds[adIds.length - 1]]
          : []
        : adIds;

    let updated: AdMarker | undefined;
    updateMarkers((prev) => {
      const next = prev.map((m) =>
        m.id === adPickerMarker.id ? { ...m, adIds: normalized } : m
      );
      updated = next.find((m) => m.id === adPickerMarker.id);
      return next;
    });
    if (updated) await persistMarker(updated, persistGenRef.current);
  };

  useKeyboardShortcuts(
    {
      onSpace: player.togglePlay,
      onUndo: undo,
      onRedo: redo,
    },
    !adPickerMarkerId
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-red-600">
        <p>{error}</p>
        <button
          type="button"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <Header />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          playing={player.playing}
          episodeFilename={episodeFilename}
          podcastVideos={podcastVideos}
          episodeLoading={episodeLoading}
          volume={volume}
          onVolumeChange={setVolume}
          onTogglePlay={player.togglePlay}
          onUploadEpisode={handleUploadEpisode}
          onSelectEpisode={handleSelectEpisode}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <div className="flex min-h-0 flex-1 gap-4">
            <MarkerPanel
              adsCatalog={adsCatalog}
              markers={markers}
              selectedId={selectedId}
              episodeReady={player.episodeReady}
              performance={performance}
              onSelect={handleSelectMarker}
              onAdd={handleAddMarker}
              onRandomMarker={handleRandomMarker}
              onDelete={handleDelete}
              onModeChange={handleModeChange}
              onPickAd={setAdPickerMarkerId}
            />
            <VideoPlayer
              episodeVideoRef={player.episodeVideoRef}
              adVideoRef={player.adVideoRef}
              showingAd={player.showingAd}
              playing={player.playing}
              episodeTime={playhead.episodeTime}
              episodeDuration={player.episodeDuration}
              episodeReady={player.episodeReady}
              episodeLoading={episodeLoading && !player.episodeReady}
              timelineTime={player.timelineTime}
              totalDuration={player.totalDuration}
              inAd={playhead.inAd}
              onTogglePlay={player.togglePlay}
              onSkip={player.skip}
              onSeek={player.seek}
            />
          </div>

          <Timeline
            markers={markers}
            adsCatalog={adsCatalog}
            episodeDuration={player.episodeDuration}
            episodeReady={player.episodeReady}
            playing={player.playing}
            performance={performance}
            timelineTime={player.timelineTime}
            selectedId={selectedId}
            pixelsPerSecond={pixelsPerSecond}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onZoom={setPixelsPerSecond}
            onSeek={player.seek}
            onSelect={handleSelectMarker}
            onMarkerMove={handleMarkerMove}
          />
        </main>
      </div>

      {adPickerMarker && (
        <AdPickerModal
          open
          mode={adPickerMarker.mode}
          ads={adsCatalog}
          selectedIds={adPickerMarker.adIds}
          onClose={() => setAdPickerMarkerId(null)}
          onSave={(adIds) => {
            void handleAdIdsSave(adIds);
            if (adPickerMarker.mode === "static") setAdPickerMarkerId(null);
          }}
        />
      )}
    </div>
  );
}
