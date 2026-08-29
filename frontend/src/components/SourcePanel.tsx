import { FileText } from "lucide-react";
import type { ChatSource } from "../lib/api";

interface SourcePanelProps {
  sources: ChatSource[] | null;
  activeChunk: number | null;
  onSelect: (chunkNumber: number | null) => void;
}

export function SourcePanel({ sources, activeChunk, onSelect }: SourcePanelProps) {
  return (
    <aside className="w-80 shrink-0 border-l border-base-700 bg-base-850 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-base-700">
        <p className="text-xs uppercase tracking-wide text-ink-500">Retrieved sources</p>
      </div>

      {!sources && (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-ink-700">
            Ask a question. Retrieved chunks will appear here, matched to the citation markers in
            the answer.
          </p>
        </div>
      )}

      {sources && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {sources.map((s) => {
            const isActive = activeChunk === s.chunkNumber;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(isActive ? null : s.chunkNumber)}
                className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                  isActive
                    ? "border-source-500 bg-source-950"
                    : "border-base-700 bg-base-900 hover:border-base-600"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className={`font-display text-[11px] px-1.5 h-5 inline-flex items-center rounded ${
                      isActive ? "bg-source-500 text-base-950" : "bg-base-700 text-ink-300"
                    }`}
                  >
                    {s.chunkNumber}
                  </span>
                  <FileText size={11} className="text-ink-700" />
                  <span className="text-[11px] text-ink-700">chunk {s.chunkIndex}</span>
                </div>
                <p className="text-xs text-ink-300 leading-relaxed line-clamp-4">{s.content}</p>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
