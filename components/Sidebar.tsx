"use client";

import {
  BarChart3,
  ChevronDown,
  Download,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Monitor,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { VidpodLogo } from "./VidpodLogo";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Megaphone, label: "Ads", active: true },
  { icon: Monitor, label: "Channels" },
  { icon: Download, label: "Import" },
  { icon: Settings, label: "Settings" },
];

type SidebarProps = {
  episodeFilename: string | null;
  podcastVideos: { filename: string; name: string }[];
  episodeLoading: boolean;
  onUploadEpisode: (file: File) => Promise<void>;
  onSelectEpisode: (filename: string) => Promise<void>;
};

export function Sidebar({
  episodeFilename,
  podcastVideos,
  episodeLoading,
  onUploadEpisode,
  onSelectEpisode,
}: SidebarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadEpisode(file);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <aside className="flex h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-[#e5e7eb] bg-[#fafafa]">
      <div className="px-5 pt-5 pb-3">
        <VidpodLogo />
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] text-[13px] font-medium text-white transition hover:bg-[#1f2937]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Create an episode
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleFile}
        />

        <div className="relative mt-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded bg-gradient-to-br from-amber-100 to-orange-200">
              <div className="h-full w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI0Y5Q0E3OCIvPjx0ZXh0IHg9IjEyIiB5PSIxNSIgZm9udC1zaXplPSI4IiBmaWxsPSIjOTI0MDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pjwvc3ZnPg==')] bg-cover" />
            </div>
            <select
              className="min-w-0 flex-1 appearance-none truncate bg-transparent pr-5 text-[13px] font-medium text-[#111827] outline-none"
              value={episodeFilename ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) void onSelectEpisode(v);
              }}
            >
              <option value="" disabled>
                {episodeLoading || uploading ? "Loading…" : "The Diary Of A CEO"}
              </option>
              {podcastVideos.map((v) => (
                <option key={v.filename} value={v.filename}>
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-5 h-3.5 w-3.5 text-[#9ca3af]" />
          </div>
        </div>
      </div>

      <nav className="mt-5 flex flex-col gap-0.5 px-3">
        {NAV.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            type="button"
            className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition ${
              active
                ? "font-semibold text-[#111827]"
                : "font-medium text-[#6b7280] hover:bg-white/80 hover:text-[#374151]"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#111827]" />
            )}
            <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2 : 1.5} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mx-3 mt-5 rounded-xl border border-[#e5e7eb] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium text-[#9ca3af]">Weekly plays</p>
          <span className="flex items-center gap-0.5 rounded-full bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#059669]">
            ↑ 17%
          </span>
        </div>
        <p className="mt-0.5 text-[22px] font-semibold tracking-tight text-[#111827]">
          738,849
        </p>
        <svg viewBox="0 0 120 32" className="mt-2 h-7 w-full" aria-hidden>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 26 L12 20 L24 23 L36 14 L48 18 L60 10 L72 15 L84 8 L96 12 L108 6 L120 9"
            fill="none"
            stroke="#10b981"
            strokeWidth="1.75"
          />
          <path
            d="M0 26 L12 20 L24 23 L36 14 L48 18 L60 10 L72 15 L84 8 L96 12 L108 6 L120 9 L120 32 L0 32 Z"
            fill="url(#spark)"
          />
        </svg>
        <div className="mt-2.5 flex justify-center gap-1">
          <span className="h-1 w-1 rounded-full bg-[#111827]" />
          <span className="h-1 w-1 rounded-full bg-[#d1d5db]" />
          <span className="h-1 w-1 rounded-full bg-[#d1d5db]" />
        </div>
      </div>

      <div className="mt-auto px-4 pb-4 pt-3">
        <div className="flex flex-col gap-0.5 border-t border-[#e5e7eb] pt-3">
          <label className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-[13px] text-[#6b7280] hover:bg-white">
            <span>Demo mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              onClick={() => setDemoMode((v) => !v)}
              className={`relative h-[18px] w-8 rounded-full transition ${demoMode ? "bg-[#111827]" : "bg-[#d1d5db]"}`}
            >
              <span
                className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition ${demoMode ? "left-[14px]" : "left-0.5"}`}
              />
            </button>
          </label>
          {[
            { icon: Users, label: "Invite your team" },
            { icon: Lightbulb, label: "Give feedback" },
            { icon: HelpCircle, label: "Help & support" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#6b7280] transition hover:bg-white hover:text-[#374151]"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 px-2 text-[11px] text-[#9ca3af]">Video first podcasts</p>
      </div>
    </aside>
  );
}
