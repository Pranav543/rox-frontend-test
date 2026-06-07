"use client";

import { Bell, ChevronDown, Settings } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-end gap-2 px-8">
      <button
        type="button"
        className="rounded-lg p-2 text-[#6b7280] transition hover:bg-white hover:text-[#111827]"
        aria-label="Settings"
      >
        <Settings className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="relative rounded-lg p-2 text-[#6b7280] transition hover:bg-white hover:text-[#111827]"
        aria-label="Notifications"
      >
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        <Bell className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-lg border border-[#e5e7eb] bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition hover:bg-[#fafafa]"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-300 to-violet-400" />
        <span className="text-sm font-medium text-[#111827]">Emma Warren</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>
    </header>
  );
}
