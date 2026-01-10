"use client";

import { ClipboardList, FileText } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white/60 backdrop-blur-sm border-r border-zinc-200/70 flex-shrink-0 hidden md:flex flex-col">
      {/* Session Info */}
      <div className="p-6 border-b border-zinc-200/50">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Current Session
        </h2>
        <p className="text-sm font-medium text-zinc-900 mb-1">
          Today&apos;s Consult
        </p>
        <p className="text-xs text-zinc-600">
          Patient: <span className="text-zinc-900">(selected in EMR)</span>
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1.5">
          {/* Draft Orders - Active */}
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-900 bg-[#F9F3EE] rounded-full hover:bg-[#F5EDE5] transition-all">
            <ClipboardList className="w-4 h-4" />
            Draft Orders
          </button>

          {/* Notes - Coming Soon */}
          <button
            disabled
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-400 rounded-full cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            Notes
            <span className="ml-auto text-xs text-zinc-400">(soon)</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-200/50">
        <p className="text-xs text-zinc-500">
          Clinical Action Layer v0.1
        </p>
      </div>
    </aside>
  );
}
