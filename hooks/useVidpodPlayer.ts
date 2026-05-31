"use client";

import { adSrcByIdFromCatalog } from "@/lib/ads";
import { resolveAdForMarker } from "@/lib/marker-config";
import { buildTimeline, type TimelineSegment } from "@/lib/playback";
import {
  findAdSegmentAtTimeline,
  findAdSegmentForAdPlayback,
  findEpisodeSegmentAtEpisodeTime,
  segmentAfter,
  syncEpisodePlayback,
} from "@/lib/playback-sync";
import type { AdPerformance } from "@/lib/marker-config";
import type { Ad, AdMarker } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useVidpodPlayer(
  markers: AdMarker[],
  episodeSrc: string,
  adsCatalog: Ad[],
  performance: Record<string, AdPerformance> = {}
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [episodeDuration, setEpisodeDuration] = useState(0);
  const [episodeReady, setEpisodeReady] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const seekingRef = useRef(false);
  const transitioningRef = useRef(false);
  const suppressVideoEventsRef = useRef(false);
  const playingRef = useRef(false);
  const timelineTimeRef = useRef(0);
  const segmentsRef = useRef<TimelineSegment[]>([]);
  const episodeSrcRef = useRef(episodeSrc);
  const adsCatalogRef = useRef(adsCatalog);
  const markersRef = useRef(markers);
  const performanceRef = useRef(performance);
  const episodeReadyRef = useRef(false);
  const episodeDurationRef = useRef(0);

  useEffect(() => {
    episodeSrcRef.current = episodeSrc;
  }, [episodeSrc]);
  useEffect(() => {
    adsCatalogRef.current = adsCatalog;
  }, [adsCatalog]);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);
  useEffect(() => {
    performanceRef.current = performance;
  }, [performance]);
  useEffect(() => {
    episodeReadyRef.current = episodeReady;
  }, [episodeReady]);
  useEffect(() => {
    episodeDurationRef.current = episodeDuration;
  }, [episodeDuration]);

  const { segments, totalDuration } = useMemo(
    () =>
      buildTimeline(markers, episodeDuration, adsCatalog, performance),
    [markers, episodeDuration, adsCatalog, performance]
  );

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    timelineTimeRef.current = timelineTime;
  }, [timelineTime]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const setPlayingState = useCallback((next: boolean) => {
    playingRef.current = next;
    setPlaying(next);
  }, []);

  const isEpisodeVideo = useCallback((video: HTMLVideoElement) => {
    const src = video.src || "";
    if (src.includes("/api/media/podcast/") || src.includes("podcast%2F")) {
      return true;
    }
    const ep = episodeSrcRef.current;
    return ep.length > 0 && src.includes(encodeURIComponent(ep));
  }, []);

  const syncTimeline = useCallback((t: number) => {
    timelineTimeRef.current = t;
    setTimelineTime(t);
  }, []);

  const playEpisode = useCallback(
    async (episodeTime: number, autoplay: boolean) => {
      const v = videoRef.current;
      const src = episodeSrcRef.current;
      if (!v || !src) return;

      suppressVideoEventsRef.current = true;
      seekingRef.current = true;

      if (!isEpisodeVideo(v)) {
        v.src = src;
        await new Promise<void>((res) => {
          const done = () => {
            v.removeEventListener("loadedmetadata", done);
            res();
          };
          v.addEventListener("loadedmetadata", done);
          v.load();
        });
      }

      v.currentTime = Math.max(0, episodeTime);
      seekingRef.current = false;

      if (autoplay) {
        try {
          await v.play();
          playingRef.current = true;
          setPlaying(true);
        } catch {
          setPlayingState(false);
        }
      } else {
        v.pause();
      }

      suppressVideoEventsRef.current = false;
    },
    [isEpisodeVideo, setPlayingState]
  );

  const playAd = useCallback(
    async (adId: string, autoplay: boolean) => {
      const v = videoRef.current;
      const src = adSrcByIdFromCatalog(adsCatalogRef.current, adId);
      if (!v || !src) return false;

      suppressVideoEventsRef.current = true;
      seekingRef.current = true;
      v.src = src;
      await new Promise<void>((res) => {
        const done = () => {
          v.removeEventListener("loadedmetadata", done);
          res();
        };
        v.addEventListener("loadedmetadata", done);
        v.load();
      });
      v.currentTime = 0;
      seekingRef.current = false;

      if (autoplay) {
        try {
          await v.play();
          playingRef.current = true;
          setPlaying(true);
        } catch {
          setPlayingState(false);
        }
      } else {
        v.pause();
      }

      suppressVideoEventsRef.current = false;
      return true;
    },
    [setPlayingState]
  );

  const goToTimelineRef = useRef<(t: number, autoplay: boolean) => Promise<void>>(
    async () => {}
  );

  const goToTimeline = useCallback(
    async (t: number, autoplay: boolean) => {
      if (!episodeReadyRef.current || episodeDurationRef.current <= 0) return;

      const segs = segmentsRef.current;
      if (segs.length === 0) return;

      const clamped = Math.max(0, Math.min(t, segs[segs.length - 1].timelineEnd));
      let seg: TimelineSegment | null = null;
      for (const s of segs) {
        if (clamped >= s.timelineStart && clamped < s.timelineEnd) {
          seg = s;
          break;
        }
      }
      if (!seg) seg = segs[segs.length - 1];

      syncTimeline(clamped);

      if (seg.type === "episode") {
        const epTime = seg.episodeStart + (clamped - seg.timelineStart);
        await playEpisode(epTime, autoplay);
        return;
      }

      if (seg.type === "ad") {
        const marker = markersRef.current.find((m) => m.id === seg.markerId);
        const adId =
          seg.adId ||
          (marker
            ? resolveAdForMarker(marker, {
                forPlayback: true,
                performance: performanceRef.current,
              })
            : null);
        if (adId) await playAd(adId, autoplay);
      }
    },
    [playAd, playEpisode, syncTimeline]
  );

  goToTimelineRef.current = goToTimeline;

  const transitionToNext = useCallback(
    async (after: TimelineSegment) => {
      if (transitioningRef.current) return;
      const next = segmentAfter(after, segmentsRef.current);
      if (!next || !playingRef.current) return;

      transitioningRef.current = true;
      suppressVideoEventsRef.current = true;
      try {
        await goToTimelineRef.current(next.timelineStart, true);
      } finally {
        transitioningRef.current = false;
        suppressVideoEventsRef.current = false;
      }
    },
    []
  );

  const seek = useCallback((t: number) => {
    void goToTimelineRef.current(t, playingRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !episodeReadyRef.current) return;

    if (playingRef.current) {
      suppressVideoEventsRef.current = true;
      v.pause();
      suppressVideoEventsRef.current = false;
      setPlayingState(false);
      return;
    }

    setPlayingState(true);
    void goToTimelineRef.current(timelineTimeRef.current, true);
  }, [setPlayingState]);

  const skip = useCallback((delta: number) => {
    seek(timelineTimeRef.current + delta);
  }, [seek]);

  const tickPlayback = useCallback(() => {
    if (seekingRef.current || suppressVideoEventsRef.current || transitioningRef.current) {
      return;
    }

    const v = videoRef.current;
    if (!v) return;

    const segs = segmentsRef.current;
    if (segs.length === 0) return;

    if (isEpisodeVideo(v)) {
      const epTime = v.currentTime;
      const sync = syncEpisodePlayback(epTime, segs);
      syncTimeline(sync.timelineTime);

      if (playingRef.current && sync.shouldTransitionToAd && sync.adSegment) {
        const epSeg = sync.episodeSegment;
        if (epSeg) void transitionToNext(epSeg);
      }
      return;
    }

    const t = timelineTimeRef.current;
    const adSeg = findAdSegmentForAdPlayback(t, segs);
    if (!adSeg) return;

    const newT = Math.min(
      adSeg.timelineStart + v.currentTime,
      adSeg.timelineEnd
    );
    syncTimeline(newT);

    const dur = v.duration;
    if (
      playingRef.current &&
      Number.isFinite(dur) &&
      dur > 0 &&
      (v.ended || v.currentTime >= dur - 0.2)
    ) {
      void transitionToNext(adSeg);
    }
  }, [isEpisodeVideo, syncTimeline, transitionToNext]);

  const tickPlaybackRef = useRef(tickPlayback);
  tickPlaybackRef.current = tickPlayback;

  const handleEnded = useCallback(() => {
    if (seekingRef.current || transitioningRef.current) return;

    const v = videoRef.current;
    if (!v || !playingRef.current) return;

    const segs = segmentsRef.current;
    const t = timelineTimeRef.current;

    if (!isEpisodeVideo(v)) {
      const adSeg = findAdSegmentForAdPlayback(t, segs);
      if (adSeg) void transitionToNext(adSeg);
      return;
    }

    const epSeg = findEpisodeSegmentAtEpisodeTime(v.currentTime, segs);
    if (epSeg) {
      const next = segmentAfter(epSeg, segs);
      if (next?.type === "ad") {
        void transitionToNext(epSeg);
      } else {
        setPlayingState(false);
      }
    }
  }, [isEpisodeVideo, setPlayingState, transitionToNext]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => {
      if (suppressVideoEventsRef.current || seekingRef.current) return;
      setPlayingState(true);
    };

    const onPause = () => {
      if (
        suppressVideoEventsRef.current ||
        seekingRef.current ||
        transitioningRef.current
      ) {
        return;
      }
      if (v.ended) return;
      setPlayingState(false);
    };

    const onLoaded = () => {
      if (isEpisodeVideo(v) && Number.isFinite(v.duration) && v.duration > 0) {
        setEpisodeDuration(v.duration);
        setEpisodeReady(true);
      }
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", tickPlayback);
    v.addEventListener("ended", handleEnded);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", tickPlayback);
      v.removeEventListener("ended", handleEnded);
    };
  }, [episodeReady, handleEnded, tickPlayback, isEpisodeVideo, setPlayingState]);

  useEffect(() => {
    if (!playing || !episodeReady) return;

    let frame = 0;
    const loop = () => {
      tickPlaybackRef.current();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, episodeReady]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !episodeSrc) {
      setEpisodeReady(false);
      setEpisodeDuration(0);
      return;
    }

    suppressVideoEventsRef.current = true;
    seekingRef.current = true;
    setEpisodeReady(false);
    setEpisodeDuration(0);
    v.pause();
    setPlayingState(false);
    syncTimeline(0);
    v.src = episodeSrc;
    v.load();

    const onMeta = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        setEpisodeDuration(v.duration);
        setEpisodeReady(true);
      }
      seekingRef.current = false;
      suppressVideoEventsRef.current = false;
      v.removeEventListener("loadedmetadata", onMeta);
    };
    v.addEventListener("loadedmetadata", onMeta);

    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [episodeSrc, setPlayingState, syncTimeline]);

  return {
    videoRef,
    episodeDuration,
    episodeReady,
    totalDuration,
    timelineTime,
    playing,
    segments,
    seek,
    togglePlay,
    skip,
  };
}
