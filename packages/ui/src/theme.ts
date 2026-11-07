import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "cp:theme";
const EVENT = "cp:theme-change";

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(): Theme {
  return readStored() ?? systemTheme();
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    document.documentElement.dataset.themeUnsaved = "true";
  }
  apply(theme);
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const [theme, setCurrent] = useState<Theme>(resolveTheme);

  useEffect(() => {
    const sync = () => {
      const next = resolveTheme();
      apply(next);
      setCurrent(next);
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme],
  );

  return { theme, toggle };
}
