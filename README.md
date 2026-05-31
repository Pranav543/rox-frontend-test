# Vidpod — Dynamic Ads Editor

Full-stack app for podcasters to mark where ads should play in an episode and choose how ads are selected (static, auto, or A/B). Preview playback with ads injected on the timeline, persist markers in SQLite, and export a single stitched MP4.

## Quick start

```bash
npm install
npm run dev          # or: npm run dev:clean  (clears .next cache)
```

Open [http://localhost:3000](http://localhost:3000).

**MP4 export** requires [ffmpeg](https://ffmpeg.org/) on your machine (`brew install ffmpeg` on macOS).

```bash
npm test                              # unit tests
node scripts/test-api.mjs             # API smoke (dev server running)
node scripts/test-export.mjs --full     # export pipeline (slow)
```

---

## Implemented features

### Ad markers & modes
- Create, update, delete markers (CRUD + SQLite persistence)
- **Static** — always plays the first ad in the marker’s pool
- **Auto** — random ad from pool on each play-through; stable preview on timeline/export
- **A/B** — plays the ad with highest CTR from `data/ad-performance.json` (polled every 2s)
- Per-marker ad picker modal (single ad for static, multi-select for auto/A/B)
- Mode cycle button, random marker generator, delete marker

### Timeline & editing
- Visual timeline with episode + ad blocks (total duration includes ad slots)
- Draggable markers (episode-time accurate; skips ad blocks while dragging)
- Timeline click / playhead seek; red playhead with handle
- Zoom in/out; auto-scroll to playhead while playing
- Decorative waveform bars (seeded, not from audio)
- Undo / redo for marker list (history stack)

### Video player
- Dual `<video>` elements — episode + ad, no `src` swap glitches
- Plays episode, then ad at each marker, then resumes episode
- Timeline time vs episode time labels; “Ad break” badge
- Draggable progress slider; skip ±10s
- **Spacebar** play/pause (disabled while ad picker modal is open)
- Volume control (both videos)
- Episode muted during ad breaks (no background episode audio)

### Episode & media
- **Episode upload** — sidebar “Upload video” → `data/podcast/`
- **Episode select** — dropdown of podcast videos in `data/podcast/`
- Sample ads in `data/ads/` + catalog in `data/ads.json`
- Media served at `/api/media/podcast/...` and `/api/media/ads/...`
- Browser probes real video durations for timeline/export

### Export (bonus #3)
- **Export MP4** — stitches episode segments + ads via ffmpeg
- Streaming progress bar (% + stage) during export
- Success notification + browser download when complete
- Files saved under `data/exports/` (gitignored)

### UI polish
- Sidebar with hover states (links are placeholders)
- Marker row / timeline transitions; selected marker highlight

### Backend API

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/markers` | List / create markers |
| PUT/DELETE | `/api/markers/[id]` | Update / delete marker |
| GET/POST | `/api/episode` | Current episode, list videos, upload/select |
| GET | `/api/ads` | Ad catalog |
| GET | `/api/ad-performance` | Live A/B performance JSON |
| GET/POST | `/api/export` | ffmpeg status / start export (NDJSON progress stream) |
| GET | `/api/export/[filename]` | Download exported MP4 |
| GET | `/api/media/[...path]` | Stream `data/podcast` or `data/ads` files |

---

## Directory structure

```
rox-frontend-test-3/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main Vidpod page (state, sync, shortcuts)
│   └── api/
│       ├── markers/            # Marker CRUD
│       ├── episode/            # Episode GET + upload/select POST
│       ├── ads/                # Ad catalog GET
│       ├── ad-performance/     # A/B metrics JSON
│       ├── export/             # MP4 export + download
│       └── media/[...path]/    # Video file streaming
├── components/
│   ├── Header.tsx
│   ├── Sidebar.tsx             # Episode upload/select, play, volume
│   ├── MarkerPanel.tsx         # Marker list + export button
│   ├── MarkerRow.tsx
│   ├── AdPickerModal.tsx
│   ├── VideoPlayer.tsx
│   ├── Timeline.tsx
│   └── ExportButton.tsx
├── hooks/
│   ├── useVidpodPlayer.ts      # Playback, ads, seek, dual video
│   ├── useUndoRedo.ts
│   ├── useKeyboardShortcuts.ts
│   └── useProbeDurations.ts
├── lib/
│   ├── db.ts                   # SQLite (markers, settings, ads)
│   ├── types.ts
│   ├── media.ts                # Paths, uploads, safe file access
│   ├── ads.ts / ads-server.ts  # Client helpers + catalog
│   ├── marker-config.ts        # Static / auto / A/B resolution
│   ├── playback*.ts            # Timeline build, sync, segments
│   ├── export-plan.ts          # Export segment list
│   ├── video-export.ts         # ffmpeg stitch
│   ├── ffmpeg.ts
│   ├── export-stream.ts        # NDJSON progress parsing
│   └── …tests (*.test.ts)
├── data/
│   ├── podcast/                # Main episode(s)
│   ├── ads/                    # Ad MP4s
│   ├── ads.json                # Sample ad metadata
│   ├── ad-performance.json       # A/B CTR demo data
│   ├── exports/                # Generated MP4s (gitignored)
│   └── vidpod.db               # SQLite (gitignored)
├── scripts/
│   ├── test-api.mjs
│   ├── test-export.mjs
│   └── test-playback-transitions.mjs
├── package.json
└── vitest.config.ts
```

---

## Bonus features

| # | Feature | Status |
|---|---------|--------|
| 1 | Video & ad upload | **Partial** — episode only |
| 2 | Real waveforms | **Not implemented** |
| 3 | MP4 export with ads | **Implemented** — see [Export](#export-bonus-3) above |
| 4 | HLS (4 qualities + ad interstitials) | **Not implemented** |
| 5 | Transcript scrub UI | **Not implemented** |
| 6 | Production hosting | **Not implemented** (local dev only) |
| 7 | Durable / reliable pipelines | **Not implemented** |

Below is how each gap could be closed using patterns already in this repo.

### 1. Ad upload (partial)

**Today:** `POST /api/episode` accepts multipart uploads and `savePodcastUpload()` writes to `data/podcast/`. `GET /api/ads` returns the catalog, but there is no `POST /api/ads`. `upsertAd()` in `lib/db.ts` and `listAdsFromDb()` in `lib/ads-server.ts` are already wired for DB-backed ads.

**How to finish:**

1. Add `saveAdUpload()` in `lib/media.ts` (same idea as podcast: write to `data/ads/`, return `ads/filename.mp4`).
2. Extend `app/api/ads/route.ts` with `POST` handling `multipart/form-data` — copy the flow from `app/api/episode/route.ts` (read `file` from `formData`, validate extension, save, probe duration with `probeMediaDurationSec`).
3. Call `upsertAd(id, name, filename, duration)` and return the new `Ad` JSON.
4. In `AdPickerModal.tsx`, add an “Upload ad” `<input type="file">` that `fetch("/api/ads", { method: "POST", body: formData })`, then refresh the ads list on the page (same as episode upload in `Sidebar.tsx`).

No change to playback or export logic — new files automatically work with `safeMediaPath()` and the existing catalog.

### 2. Real waveforms

**Today:** `generateWaveformBars()` in `lib/timeline-visual.ts` produces fake bars; `Timeline.tsx` renders them at a fixed bar count.

**How to implement:**

1. **Offline peaks** — When an episode or ad is uploaded (or on first load), run ffmpeg once:
   ```bash
   ffmpeg -i input.mp4 -af asetnsamples=1024,astats=metadata=1:reset=1 -f null -
   ```
   Or use [audiowaveform](https://github.com/bbc/audiowaveform) to output JSON peaks. Store under `data/waveforms/{mediaKey}.json` (array of normalized amplitudes per time bucket).
2. **API** — `GET /api/waveform?file=podcast/main-video.mp4` returns cached JSON or generates it on miss (same progress pattern as export).
3. **UI** — Replace `WAVEFORM` constant in `Timeline.tsx` with fetched peaks; map `timelineTime` → bar index. Re-fetch when `episodeUrl` or ad catalog changes.
4. **Performance** — Downsample to ~200–400 buckets for the visible width; cache in SQLite or filesystem so scrubbing stays instant.

The timeline layout (`pixelsPerSecond`, segment blocks) stays the same — only the bar heights become real.

### 3. MP4 export with ads — implemented

Already built: `buildExportPlan()` mirrors playback ad picks, `renderExportToFile()` cuts episode slices and ad clips with ffmpeg, concat re-encodes with aligned audio, and `POST /api/export` streams NDJSON progress to `ExportButton`. Requires ffmpeg on the server host.

### 4. HLS with 4 qualities and ad interstitials

**Today:** Single progressive MP4 download. Export plan already defines ordered segments (episode → ad → episode).

**How to implement:**

1. **Base encode** — After stitch (or instead of one MP4), run ffmpeg ABR ladder, e.g. 1080p / 720p / 480p / 360p:
   ```bash
   ffmpeg -i stitched.mp4 -filter_complex "[0:v]split=4[v1][v2][v3][v4]" ...
   ```
   Or run four `-vf scale=` passes into separate segment directories.
2. **HLS packaging** — Per rendition:
   ```bash
   ffmpeg -i rend_720.mp4 -c copy -f hls -hls_time 6 -hls_playlist_type vod playlist_720.m3u8
   ```
3. **Master playlist** — `master.m3u8` listing all `EXT-X-STREAM-INF` bandwidth/ resolution variants.
4. **Ads as interstitials** — Two practical options:
   - **Single timeline (simpler):** Stitch ads into one mezzanine MP4 first (current export), then HLS that file — ads are baked in, same as today.
   - **Server-side interstitials (harder):** Keep episode HLS and ad HLS separate; master playlist uses `EXT-X-DATERANGE` / discontinuity tags at marker times, or a custom player (hls.js) that swaps source URL at offsets from marker DB.
5. **Player** — Replace `<video src>` with [hls.js](https://github.com/video-dev/hls.js) for Safari/native HLS fallback.

Marker times in SQLite become the schedule for discontinuities or for the stitch step.

### 5. Transcript scrub UI

**Today:** Scrubbing is visual (timeline + waveform bars) only.

**How to implement:**

1. **Extract audio** — `ffmpeg -i episode.mp4 -vn -acodec pcm_s16le -ar 16000 audio.wav` (can run after episode upload).
2. **Transcribe** — OpenAI Whisper API, local whisper.cpp, or Deepgram — return segments `{ start, end, text }[]`. Store in `data/transcripts/{episodeId}.json` or a SQLite `transcript_segments` table.
3. **API** — `GET /api/transcript?episode=...` returns segments; optional `POST` to trigger generation (long-running → use job queue in #7).
4. **UI** — Panel beside the timeline (or below player): list segments; click sets `player.seek(episodeTime)` using existing `timelinePositionToEpisodeTime` / episode mapping. Highlight active segment from `playhead.episodeTime`.
5. **Markers** — Optional: snap new markers to nearest segment start for easier ad placement.

Reuse `useVidpodPlayer` seek paths — no change to dual-video ad logic.

### 6. Production hosting

**Today:** Next.js dev server, files on disk under `data/`, ffmpeg invoked in-process on export.

**Suggested layout:**

| Piece | Where | Why |
|-------|--------|-----|
| Next.js UI | Vercel or similar | App Router + API routes deploy easily; set `maxDuration` / Node runtime for export |
| Media storage | S3, Cloudflare R2, or GCS | Episode/ad MP4s too large for serverless disk; upload via presigned URLs |
| CDN | CloudFront / Cloudflare CDN | Serve `/api/media` equivalent as public or signed URLs |
| Export / HLS workers | Separate Node worker, Railway, Fly.io, or ECS | ffmpeg is CPU-heavy and long-running — ill-suited to short serverless timeouts |
| Database | Turso (SQLite-compatible), Postgres, or RDS | Replace file-backed SQLite for multi-instance APIs |
| HLS output | Same bucket as media, `application/vnd.apple.mpegurl` | Players fetch `master.m3u8` from CDN |

**Flow:** Browser uploads to presigned URL → worker webhooks on complete → generates waveform + transcript + HLS → writes manifest URLs to DB → UI reads markers from API and plays HLS URL.

For a take-home demo, local disk + `npm run dev` is enough; production splits **stateless API** from **stateful media workers**.

### 7. Durable / reliable pipelines

**Today:** `POST /api/export` runs ffmpeg in the same request with a streaming response. If the process crashes, the client loses progress and there is no retry.

**How to implement:**

1. **Job model** — Table `export_jobs (id, status, progress, output_path, error, created_at)` with statuses `queued | running | done | failed`.
2. **Enqueue** — `POST /api/export` inserts a row and returns `{ jobId }` immediately (or keep stream for UI but back it with a job id).
3. **Worker** — BullMQ + Redis, SQS + Lambda with ffmpeg layer, or a simple cron/worker process polling `queued` jobs. Worker calls existing `renderExportToFile()` and updates `progress` in DB (same percentages as `export-progress.ts`).
4. **Poll / stream** — Client polls `GET /api/export/jobs/[id]` or subscribes via SSE; on `done`, show download link from `output_path`.
5. **Idempotency** — Same marker set + episode filename → hash as dedup key to avoid duplicate encodes.
6. **Cleanup** — TTL job to delete old files in `data/exports/`.

Apply the same pattern to waveform generation and transcription (bonus #2 and #5) so nothing long-running blocks the HTTP request.

---

## Stack

Next.js 15 · React 19 · Tailwind CSS 4 · better-sqlite3 · @dnd-kit · ffmpeg (export) · Vitest
