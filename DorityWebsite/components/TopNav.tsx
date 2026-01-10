"use client";

import { Activity, ExternalLink, Settings } from "lucide-react";

export default function TopNav() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-zinc-200/70 px-6 py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Page Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#7C2D3E] to-[#5A1F2D] rounded-lg flex items-center justify-center shadow-sm">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900">
              Draft Clinical Actions
            </h1>
            <p className="text-xs text-zinc-600">
              AI-powered consultation assistant
            </p>
          </div>
        </div>

        {/* Right: Secondary Actions */}
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-lg transition-all flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Medplum
          </button>
          <button className="p-1.5 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-lg transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
