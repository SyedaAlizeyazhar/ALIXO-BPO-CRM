import { useId } from "react";
import { BRAND } from "@/lib/config";

/* ALIXO BPO mark: gradient rounded hexagon + shared-stem "AB" ligature (logo option 1). */
export function Mark({ size = 40 }: { size?: number }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent2)" }} />
        </linearGradient>
      </defs>
      <path
        d="M46,7.3a8,8 0 0 1 8,0l31,17.9a8,8 0 0 1 4,6.9v35.8a8,8 0 0 1-4,6.9l-31,17.9a8,8 0 0 1-8,0l-31-17.9a8,8 0 0 1-4-6.9V32.1a8,8 0 0 1 4-6.9z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="7"
      />
      <g fill="none" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M29,70 L48,30" />
        <path d="M36.5,56 L48,56" />
        <path d="M50,29 V71" />
        <path d="M50,30 H60 a10,10 0 0 1 0,20 H50 M50,50 H63 a10,10 0 0 1 0,20 H50" />
      </g>
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="logo">
      <Mark size={size} />
      <span>
        <b>
          {BRAND.name} <span>{BRAND.suffix}</span>
        </b>
        <small>{BRAND.tagline}</small>
      </span>
    </span>
  );
}
