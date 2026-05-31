"use client";

import {
  episodeSegmentAfterAd,
  isAdVideoFinished,
  timelineTimeDuringAd,
  type AdTimelineSegment,
} from "@/lib/ad-playback";
import { adSrcByIdFromCatalog } from "@/lib/ads";
import { resolveAdForMarker } from "@/lib/marker-config";
import { buildTimeline, type TimelineSegment } from "@/lib/playback";
import {
  episodeTimeForTimeline,
  segmentAtTimelineTime,
} from "@/lib/playback-segment";
import {
  findEpisodeSegmentAtEpisodeTime,
  segmentAfter,
  syncEpisodePlayback,
} from "@/lib/playback-sync";
import type { AdPerformance } from "@/lib/marker-config";
import type { Ad, AdMarker } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlaybackMode =
  | { kind: "episode" }
  | { kind: "ad"; segment: AdTimelineSegment };

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    const done = () => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("error", done);
      resolve();
    };
    video.addEventListener("loadedmetadata", done);
    video.addEventListener("error", done);
  });
}

export function useVidpodPlayer(
  markers: AdMarker[],
  episodeSrc: string,
  adsCatalog: Ad[],
  performance: Record<string, AdPerformance> = {}
) {
  const episodeVideoRef = useRef<HTMLVideoElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const [showingAd, setShowingAd] = useState(false);
  const [episodeDuration, setEpisodeDuration] = useState(0);
  const [episodeReady, setEpisodeReady] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const seekingRef = useRef(false);
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
  const playbackModeRef = useRef<PlaybackMode>({ kind: "episode" });
  const showingAdRef = useRef(false);
  const seekTokenRef = useRef(0);
  const resumingFromAdRef = useRef(false);
  /** Ad markers already played this session — prevents post-resume re-trigger loop */
  const completedAdMarkerIdsRef = useRef(new Set<string>());

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
  useEffect(() => {
    showingAdRef.current = showingAd;
  }, [showingAd]);

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

  const syncTimeline = useCallback((t: number) => {
    timelineTimeRef.current = t;
    setTimelineTime(t);
  }, []);

  const activeVideo = useCallback(() => {
    return showingAdRef.current ? adVideoRef.current : episodeVideoRef.current;
  }, []);

  const mountEpisode = useCallback(
    async (
      episodeTime: number,
      timelinePos: number,
      autoplay: boolean,
      token: number
    ): Promise<boolean> => {
      const ep = episodeVideoRef.current;
      const ad = adVideoRef.current;
      if (!ep || token !== seekTokenRef.current) return false;

      suppressVideoEventsRef.current = true;
      seekingRef.current = true;

      if (ad) {
        ad.pause();
        ad.loop = false;
      }

      ep.muted = false;

      playbackModeRef.current = { kind: "episode" };
      showingAdRef.current = false;
      setShowingAd(false);
      syncTimeline(timelinePos);
      ep.currentTime = Math.max(0, episodeTime);
      seekingRef.current = false;

      if (autoplay) {
        try {
          await ep.play();
          if (token !== seekTokenRef.current) return false;
          playingRef.current = true;
          setPlaying(true);
        } catch {
          setPlayingState(false);
          return false;
        }
      } else {
        ep.pause();
      }

      suppressVideoEventsRef.current = false;
      return true;
    },
    [setPlayingState, syncTimeline]
  );

  const mountAd = useCallback(
    async (
      adId: string,
      adSeg: AdTimelineSegment,
      offsetInAd: number,
      timelinePos: number,
      autoplay: boolean,
      token: number
    ): Promise<boolean> => {
      const ep = episodeVideoRef.current;
      const ad = adVideoRef.current;
      const src = adSrcByIdFromCatalog(adsCatalogRef.current, adId);
      if (!ep || !ad || !src || token !== seekTokenRef.current) return false;

      suppressVideoEventsRef.current = true;
      seekingRef.current = true;
      playbackModeRef.current = { kind: "ad", segment: adSeg };

      ep.pause();
      ep.muted = true;

      ad.loop = false;
      ad.muted = false;
      ad.src = src;
      ad.load();
      await waitForMetadata(ad);
      if (token !== seekTokenRef.current) return false;

      showingAdRef.current = true;
      setShowingAd(true);
      syncTimeline(timelinePos);
      ad.currentTime = Math.max(0, offsetInAd);
      seekingRef.current = false;

      if (autoplay) {
        try {
          await ad.play();
          if (token !== seekTokenRef.current) return false;
          playingRef.current = true;
          setPlaying(true);
        } catch {
          setPlayingState(false);
          return false;
        }
      } else {
        ad.pause();
      }

      suppressVideoEventsRef.current = false;
      return true;
    },
    [setPlayingState, syncTimeline]
  );

  const resumeAfterAdRef = useRef<(adSeg: AdTimelineSegment) => Promise<void>>(
    async () => {}
  );

  const resumeAfterAd = useCallback(
    async (adSeg: AdTimelineSegment) => {
      if (resumingFromAdRef.current) return;
      if (playbackModeRef.current.kind !== "ad") return;

      const resume = episodeSegmentAfterAd(adSeg, segmentsRef.current);
      if (!resume) return;

      resumingFromAdRef.current = true;
      const token = ++seekTokenRef.current;

      const ad = adVideoRef.current;
      if (ad) {
        ad.pause();
        ad.currentTime = 0;
      }

      try {
        await mountEpisode(
          resume.episodeStart,
          resume.timelineStart,
          true,
          token
        );
        completedAdMarkerIdsRef.current.add(adSeg.markerId);
      } finally {
        resumingFromAdRef.current = false;
      }
    },
    [mountEpisode]
  );

  resumeAfterAdRef.current = resumeAfterAd;

  const goToTimelineRef = useRef<
    (t: number, autoplay: boolean) => Promise<void>
  >(async () => {});

  const goToTimeline = useCallback(
    async (t: number, autoplay: boolean) => {
      if (!episodeReadyRef.current || episodeDurationRef.current <= 0) return;

      const segs = segmentsRef.current;
      if (segs.length === 0) return;

      const seg = segmentAtTimelineTime(t, segs);
      if (!seg) return;

      const token = ++seekTokenRef.current;
      resumingFromAdRef.current = false;

      for (const s of segs) {
        if (s.type === "ad" && t < s.timelineStart) {
          completedAdMarkerIdsRef.current.delete(s.markerId);
        }
      }

      const clamped = Math.max(
        seg.timelineStart,
        Math.min(t, seg.timelineEnd - 0.001)
      );

      if (seg.type === "episode") {
        const epTime = episodeTimeForTimeline(clamped, seg);
        await mountEpisode(epTime, clamped, autoplay, token);
        return;
      }

      const marker = markersRef.current.find((m) => m.id === seg.markerId);
      const adId =
        seg.adId ||
        (marker
          ? resolveAdForMarker(marker, {
              forPlayback: true,
              performance: performanceRef.current,
            })
          : null);

      if (!adId) return;

      await mountAd(
        adId,
        seg,
        clamped - seg.timelineStart,
        clamped,
        autoplay,
        token
      );
    },
    [mountAd, mountEpisode]
  );

  goToTimelineRef.current = goToTimeline;

  const transitionToAd = useCallback(
    async (epSeg: Extract<TimelineSegment, { type: "episode" }>) => {
      if (!playingRef.current || resumingFromAdRef.current) return;
      const next = segmentAfter(epSeg, segmentsRef.current);
      if (next?.type !== "ad") return;
      await goToTimelineRef.current(next.timelineStart, true);
    },
    []
  );

  const seek = useCallback((t: number) => {
    void goToTimelineRef.current(t, playingRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const v = activeVideo();
    if (!v || !episodeReadyRef.current) return;

    if (playingRef.current) {
      suppressVideoEventsRef.current = true;
      episodeVideoRef.current?.pause();
      adVideoRef.current?.pause();
      suppressVideoEventsRef.current = false;
      setPlayingState(false);
      return;
    }

    setPlayingState(true);
    void goToTimelineRef.current(timelineTimeRef.current, true);
  }, [activeVideo, setPlayingState]);

  const skip = useCallback((delta: number) => {
    seek(timelineTimeRef.current + delta);
  }, [seek]);

  const tickPlayback = useCallback(() => {
    if (seekingRef.current || suppressVideoEventsRef.current) return;
    if (resumingFromAdRef.current) return;

    const segs = segmentsRef.current;
    if (segs.length === 0) return;

    const mode = playbackModeRef.current;

    if (mode.kind === "ad") {
      const ad = adVideoRef.current;
      if (!ad) return;

      syncTimeline(timelineTimeDuringAd(mode.segment, ad.currentTime));

      if (isAdVideoFinished(ad.currentTime, ad.duration) || ad.ended) {
        void resumeAfterAdRef.current(mode.segment);
      }
      return;
    }

    const ep = episodeVideoRef.current;
    if (!ep) return;

    const epTime = ep.currentTime;
    const sync = syncEpisodePlayback(epTime, segs);
    syncTimeline(sync.timelineTime);

    if (
      playingRef.current &&
      sync.shouldTransitionToAd &&
      sync.adSegment &&
      !completedAdMarkerIdsRef.current.has(sync.adSegment.markerId)
    ) {
      const epSeg = sync.episodeSegment;
      if (epSeg) void transitionToAd(epSeg);
    }
  }, [syncTimeline, transitionToAd]);

  const tickPlaybackRef = useRef(tickPlayback);
  tickPlaybackRef.current = tickPlayback;

  const handleEnded = useCallback(() => {
    if (seekingRef.current || resumingFromAdRef.current) return;

    const mode = playbackModeRef.current;

    if (mode.kind === "ad") {
      void resumeAfterAdRef.current(mode.segment);
      return;
    }

    if (!playingRef.current) return;

    const ep = episodeVideoRef.current;
    if (!ep) return;

    const segs = segmentsRef.current;
    const epSeg = findEpisodeSegmentAtEpisodeTime(ep.currentTime, segs);
    if (epSeg) {
      const next = segmentAfter(epSeg, segs);
      if (next?.type === "ad") {
        void transitionToAd(epSeg);
      } else {
        setPlayingState(false);
      }
    }
  }, [setPlayingState, transitionToAd]);

  useEffect(() => {
    const ep = episodeVideoRef.current;
    const ad = adVideoRef.current;
    if (!ep) return;

    ep.loop = false;
    if (ad) ad.loop = false;

    const onPlay = () => {
      if (suppressVideoEventsRef.current || seekingRef.current) return;
      setPlayingState(true);
    };

    const onPause = () => {
      if (suppressVideoEventsRef.current || seekingRef.current) return;
      if (resumingFromAdRef.current) return;

      const v = activeVideo();
      if (!v) return;
      if (v.ended) return;
      if (
        showingAdRef.current &&
        isAdVideoFinished(v.currentTime, v.duration)
      ) {
        return;
      }
      setPlayingState(false);
    };

    const onEpisodeMeta = () => {
      if (Number.isFinite(ep.duration) && ep.duration > 0) {
        setEpisodeDuration(ep.duration);
        setEpisodeReady(true);
      }
    };

    ep.addEventListener("play", onPlay);
    ep.addEventListener("pause", onPause);
    ep.addEventListener("loadedmetadata", onEpisodeMeta);
    ep.addEventListener("timeupdate", tickPlayback);
    ep.addEventListener("ended", handleEnded);

    if (ad) {
      ad.addEventListener("play", onPlay);
      ad.addEventListener("pause", onPause);
      ad.addEventListener("timeupdate", tickPlayback);
      ad.addEventListener("ended", handleEnded);
    }

    return () => {
      ep.removeEventListener("play", onPlay);
      ep.removeEventListener("pause", onPause);
      ep.removeEventListener("loadedmetadata", onEpisodeMeta);
      ep.removeEventListener("timeupdate", tickPlayback);
      ep.removeEventListener("ended", handleEnded);
      if (ad) {
        ad.removeEventListener("play", onPlay);
        ad.removeEventListener("pause", onPause);
        ad.removeEventListener("timeupdate", tickPlayback);
        ad.removeEventListener("ended", handleEnded);
      }
    };
  }, [activeVideo, episodeReady, handleEnded, tickPlayback, setPlayingState]);

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
    const ep = episodeVideoRef.current;
    const ad = adVideoRef.current;
    if (!ep || !episodeSrc) {
      setEpisodeReady(false);
      setEpisodeDuration(0);
      playbackModeRef.current = { kind: "episode" };
      setShowingAd(false);
      return;
    }

    ++seekTokenRef.current;
    suppressVideoEventsRef.current = true;
    seekingRef.current = true;
    setEpisodeReady(false);
    setEpisodeDuration(0);
    playbackModeRef.current = { kind: "episode" };
    showingAdRef.current = false;
    setShowingAd(false);
    resumingFromAdRef.current = false;
    completedAdMarkerIdsRef.current.clear();
    ep.pause();
    ad?.pause();
    ep.loop = false;
    if (ad) ad.loop = false;
    setPlayingState(false);
    syncTimeline(0);
    ep.src = episodeSrc;
    ep.load();

    const onMeta = () => {
      if (Number.isFinite(ep.duration) && ep.duration > 0) {
        setEpisodeDuration(ep.duration);
        setEpisodeReady(true);
      }
      seekingRef.current = false;
      suppressVideoEventsRef.current = false;
      ep.removeEventListener("loadedmetadata", onMeta);
    };
    ep.addEventListener("loadedmetadata", onMeta);

    return () => ep.removeEventListener("loadedmetadata", onMeta);
  }, [episodeSrc, setPlayingState, syncTimeline]);

  return {
    episodeVideoRef,
    adVideoRef,
    showingAd,
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
