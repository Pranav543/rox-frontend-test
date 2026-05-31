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

| # | Feature | Status | Easy path forward |
|---|---------|--------|-------------------|
| 1 | Video & ad upload | **Partial** — episode upload works; ad upload UI/API not wired | Add `POST /api/ads` multipart (mirror `episode/route.ts`), save to `data/ads/`, `upsertAd` in DB |
| 2 | Real waveforms | **Not done** — decorative bars only | Decode audio with ffmpeg/`audiowaveform`, cache peaks JSON, render bars from samples |
| 3 | MP4 export with ads | **Done** | — |
| 4 | HLS + 4 qualities + interstitials | **Not done** | ffmpeg → `.m3u8` + TS segments; master playlist; ad periods as separate renditions or SCTE-35-style discontinuities |
| 5 | Transcript scrub UI | **Not done** | ffmpeg extract audio → Whisper API → store segments; clickable transcript seeks player |
| 6 | Hosting notes | **Not done** | Static UI on Vercel; videos on S3/R2 + CloudFront; HLS via MediaConvert or self-hosted ffmpeg worker |
| 7 | Durable pipelines | **Not done** | Queue export jobs (BullMQ / SQS), persist job state in DB, idempotent retries |

---

## Stack

Next.js 15 · React 19 · Tailwind CSS 4 · better-sqlite3 · @dnd-kit · ffmpeg (export) · Vitest
