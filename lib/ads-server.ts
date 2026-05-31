import adsJson from "@/data/ads.json";
import { listAdsFromDb, syncDefaultAds, upsertAd } from "./db";
import { listAdVideoFiles, safeMediaPath } from "./media";
import type { Ad } from "./types";

function seedFromJson(): Ad[] {
  const catalog = adsJson as Ad[];
  syncDefaultAds(catalog);
  return catalog;
}

export function getAdsCatalog(): Ad[] {
  seedFromJson();
  const fromDb = listAdsFromDb();
  if (fromDb.length > 0) {
    return fromDb
      .map((r) => ({
        id: r.id,
        name: r.name,
        filename: r.filename.startsWith("ads/")
          ? r.filename
          : `ads/${r.filename}`,
        duration: r.duration,
      }))
      .filter((a) => safeMediaPath(a.filename) !== null);
  }

  const files = listAdVideoFiles();
  return files.map((filename, i) => ({
    id: `ad-${i + 1}`,
    name: filename.replace(".mp4", "").replace(/-/g, " "),
    filename: `ads/${filename}`,
    duration: 15,
  }));
}

export function getAdByIdServer(id: string): Ad | undefined {
  return getAdsCatalog().find((a) => a.id === id);
}

export function adFileExists(filename: string): boolean {
  return safeMediaPath(filename) !== null;
}
