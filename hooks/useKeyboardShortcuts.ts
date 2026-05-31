"use client";

import { useEffect, useRef } from "react";

export function useKeyboardShortcuts(
  handlers: {
    onSpace?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
  },
  enabled = true
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.closest("[data-modal]")) return;

      if (e.code === "Space") {
        e.preventDefault();
        handlersRef.current.onSpace?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onUndo?.();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        handlersRef.current.onRedo?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
