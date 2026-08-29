interface AnswerTextProps {
  text: string;
  activeChunk: number | null;
  onCiteClick: (chunkNumber: number) => void;
}

/**
 * Splits answer text on citation markers like "[chunk 2]" and renders each
 * one as a small interactive chip instead of plain text — clicking a chip
 * highlights the corresponding source in the side panel, so a claim can be
 * traced to its exact chunk without leaving the answer. This is the
 * project's signature interaction: citations as first-class, navigable
 * objects, not a footnote list at the bottom.
 */
export function AnswerText({ text, activeChunk, onCiteClick }: AnswerTextProps) {
  const parts = text.split(/(\[chunk \d+\])/g);

  return (
    <p className="text-sm text-ink-100 leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[chunk (\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;

        const chunkNumber = Number(match[1]);
        const isActive = activeChunk === chunkNumber;

        return (
          <button
            key={i}
            onClick={() => onCiteClick(chunkNumber)}
            className={`inline-flex items-center justify-center mx-0.5 px-1.5 h-5 rounded font-display text-[11px] align-middle transition-colors ${
              isActive
                ? "bg-source-500 text-base-950"
                : "bg-source-950 text-source-500 hover:bg-source-500/20 border border-source-500/40"
            }`}
          >
            {chunkNumber}
          </button>
        );
      })}
    </p>
  );
}
