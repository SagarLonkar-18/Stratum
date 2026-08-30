import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizableOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

/**
 * Drag-to-resize for a side panel, matching the pattern used in Claude/
 * ChatGPT/VS Code's sidebars. Width is persisted per-panel in localStorage
 * so it survives a refresh, and clamped to [minWidth, maxWidth] so a panel
 * can't be dragged to something unusably small or large.
 */
export function useResizable({ storageKey, defaultWidth, minWidth, maxWidth }: UseResizableOptions) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : defaultWidth;
  });
  const [isDragging, setIsDragging] = useState(false);
  // Which direction dragging right should grow the panel: left-side panels
  // grow when dragged right, right-side panels shrink when dragged right.
  const directionRef = useRef<1 | -1>(1);

  const startDragging = useCallback((direction: 1 | -1) => {
    directionRef.current = direction;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      setWidth((prev) => {
        const next = prev + e.movementX * directionRef.current;
        return Math.min(maxWidth, Math.max(minWidth, next));
      });
    }
    function handleMouseUp() {
      setIsDragging(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, minWidth, maxWidth]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  return { width, isDragging, startDragging };
}
