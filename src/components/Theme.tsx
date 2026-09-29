"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_MODE, DEFAULT_PALETTE, PALETTES, type PaletteId } from "@/lib/config";

export type Mode = "light" | "dark";
type ThemeState = { palette: PaletteId; mode: Mode; setPalette: (p: PaletteId) => void; setMode: (m: Mode) => void };

const STORAGE_KEY = "alixo_theme";
const Ctx = createContext<ThemeState | null>(null);

export const useTheme = () => useContext(Ctx)!;

/* Writes the palette + mode onto <html>. Shared with the no-flash script below. */
function apply(palette: string, mode: string) {
  const p = PALETTES.find((x) => x.id === palette) ?? PALETTES[0];
  const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.style.setProperty("--accent", p.a);
  root.style.setProperty("--accent2", p.b);
  root.style.setProperty("--glow", rgba(p.a, mode === "dark" ? 0.35 : 0.22));
  root.style.setProperty("--soft", rgba(p.a, mode === "dark" ? 0.16 : 0.1));
}

/* Runs before first paint so a saved dark theme never flashes light. */
export const themeBootScript = `(function(){try{var P=${JSON.stringify(PALETTES)};var s=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"{}");
var id=s.palette||"${DEFAULT_PALETTE}",m=s.mode||"${DEFAULT_MODE}";var p=P.filter(function(x){return x.id===id})[0]||P[0];
function a(h,o){var n=parseInt(h.slice(1),16);return "rgba("+(n>>16)+","+((n>>8)&255)+","+(n&255)+","+o+")"}
var r=document.documentElement;r.dataset.mode=m;r.style.setProperty("--accent",p.a);r.style.setProperty("--accent2",p.b);
r.style.setProperty("--glow",a(p.a,m==="dark"?.35:.22));r.style.setProperty("--soft",a(p.a,m==="dark"?.16:.1));}catch(e){}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [mode, setModeState] = useState<Mode>(DEFAULT_MODE);
  const [chosen, setChosen] = useState<boolean | null>(null); // null until localStorage is read

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (s.palette) setPaletteState(s.palette);
      if (s.mode) setModeState(s.mode);
      setChosen(!!(s.palette || s.mode));
    } catch {
      setChosen(false);
    }
  }, []);

  // Users who never picked a theme follow the admin's default.
  useEffect(() => {
    if (chosen !== false || location.pathname.startsWith("/login") || location.pathname.startsWith("/signup")) return;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (PALETTES.some((p) => p.id === d.defaultPalette)) setPaletteState(d.defaultPalette);
        if (d.defaultMode === "light" || d.defaultMode === "dark") setModeState(d.defaultMode);
      })
      .catch(() => {});
  }, [chosen]);

  // Wait for localStorage so the boot script's theme is not overwritten by the defaults.
  useEffect(() => {
    if (chosen !== null) apply(palette, mode);
  }, [palette, mode, chosen]);

  const save = useCallback((next: { palette: PaletteId; mode: Mode }) => {
    setChosen(true);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const setPalette = useCallback((p: PaletteId) => { setPaletteState(p); save({ palette: p, mode }); }, [mode, save]);
  const setMode = useCallback((m: Mode) => { setModeState(m); save({ palette, mode: m }); }, [palette, save]);

  return <Ctx.Provider value={{ palette, mode, setPalette, setMode }}>{children}</Ctx.Provider>;
}
