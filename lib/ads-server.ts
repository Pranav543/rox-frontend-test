import adsJson from "@/data/ads.json";
import { listAdsFromDb, syncDefaultAds } from "./db";
import { listAdVideoFiles, safeMediaPath } from "./media";
import type { Ad } from "./types";

function catalogFromJson(): Ad[] {
  return (adsJson as Ad[]).filter((a) => safeMediaPath(a.filename) !== null);
}

function seedFromJson(): Ad[] {
  const catalog = adsJson as Ad[];
  syncDefaultAds(catalog);
  return catalog;
}

export function getAdsCatalog(): Ad[] {
  try {
    seedFromJson();
    const fromDb = listAdsFromDb();
    if (fromDb.length > 0) {
      const fromDbFiltered = fromDb
        .map((r) => ({
          id: r.id,
          name: r.name,
          filename: r.filename.startsWith("ads/")
            ? r.filename
            : `ads/${r.filename}`,
          duration: r.duration,
        }))
        .filter((a) => safeMediaPath(a.filename) !== null);
      if (fromDbFiltered.length > 0) return fromDbFiltered;
    }

    const files = listAdVideoFiles();
    if (files.length > 0) {
      return files.map((filename, i) => ({
        id: `ad-${i + 1}`,
        name: filename.replace(".mp4", "").replace(/-/g, " "),
        filename: `ads/${filename}`,
        duration: 15,
      }));
    }
  } catch (err) {
    console.error("[getAdsCatalog] database path failed, using JSON fallback:", err);
  }

  return catalogFromJson();
}

export function getAdByIdServer(id: string): Ad | undefined {
  return getAdsCatalog().find((a) => a.id === id);
}

export function adFileExists(filename: string): boolean {
  return safeMediaPath(filename) !== null;
}
