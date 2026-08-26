"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

export const THEME_STORAGE_KEY = "carf.theme";

/** Inlined into <head> via a plain <script> (see layout.tsx) so the correct theme class is
 *  set before first paint -- reading localStorage from a React effect would flash the
 *  wrong theme for a frame on every load. */
// Defaults to dark regardless of OS preference -- that's the deliberate default look here,
// not just a fallback; only an explicit stored "light" choice turns it off.
export const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem('${THEME_STORAGE_KEY}') !== 'light') {
    document.documentElement.classList.add('dark');
  }
} catch (e) {
  document.documentElement.classList.add('dark');
}
`;

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // One-time sync from the DOM (set synchronously pre-hydration by THEME_INIT_SCRIPT,
    // an external source SSR can't see) into state -- not the "derive state from props"
    // anti-pattern the set-state-in-effect rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Non-fatal -- the choice just won't persist across reloads.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className={className}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
