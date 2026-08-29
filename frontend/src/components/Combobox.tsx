import { useState, useRef, useEffect } from "react";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}

/**
 * Free-text input with a dropdown of previously-used values. Unlike a
 * <select>, typing a brand new value is always allowed — the suggestions
 * are a convenience, not a constraint. Used for workspace type, since we
 * can't predict every category a user might want (client work, research,
 * a specific team name, etc.) and shouldn't force a choice between two
 * hardcoded options.
 */
export function Combobox({ value, onChange, suggestions, placeholder }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase(),
  );

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="bg-base-900 border border-base-600 rounded-md px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-verified-500 w-40"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full bg-base-800 border border-base-600 rounded-md overflow-hidden z-10 shadow-lg">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-ink-300 hover:bg-base-700 hover:text-ink-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
