/** Detect episode vs ad from a loaded video element src */
export function isEpisodeMediaSrc(
  videoSrc: string,
  episodeSrc: string
): boolean {
  const src = videoSrc || "";
  if (!src) return false;
  if (src.includes("/api/media/podcast/") || src.includes("podcast%2F")) {
    return true;
  }
  if (!episodeSrc) return false;
  if (src === episodeSrc || src.endsWith(episodeSrc)) return true;
  try {
    const a = new URL(src, "http://local");
    const b = new URL(episodeSrc, "http://local");
    return a.pathname === b.pathname;
  } catch {
    return src.includes(episodeSrc);
  }
}

export function isAdMediaSrc(videoSrc: string): boolean {
  const src = videoSrc || "";
  return src.includes("/api/media/ads/") || src.includes("ads%2F");
}
