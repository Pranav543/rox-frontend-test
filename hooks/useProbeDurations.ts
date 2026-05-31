"use client";

import { mediaUrl } from "@/lib/ads";
import type { Ad } from "@/lib/types";
import { useEffect, useState } from "react";

function probe(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) ? v.duration : 15);
      v.remove();
    };
    v.onerror = () => {
      resolve(15);
      v.remove();
    };
    v.src = url;
  });
}

export function useProbeDurations(ads: Ad[], episodeUrl: string | null) {
  const [catalog, setCatalog] = useState<Ad[]>(ads);
  const [episodeDurationHint, setEpisodeDurationHint] = useState<number | null>(null);

  useEffect(() => {
    setCatalog(ads);
  }, [ads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updated = await Promise.all(
        ads.map(async (ad) => {
          const d = await probe(mediaUrl(ad.filename));
          return { ...ad, duration: Math.max(1, Math.round(d)) };
        })
      );
      if (!cancelled) setCatalog(updated);
    })();
    return () => {
      cancelled = true;
    };
  }, [ads]);

  useEffect(() => {
    if (!episodeUrl) return;
    let cancelled = false;
    probe(episodeUrl).then((d) => {
      if (!cancelled) setEpisodeDurationHint(d);
    });
    return () => {
      cancelled = true;
    };
  }, [episodeUrl]);

  return { catalog, episodeDurationHint };
}
