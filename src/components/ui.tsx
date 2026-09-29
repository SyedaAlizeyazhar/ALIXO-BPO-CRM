"use client";

import clsx from "clsx";
import { forwardRef, useEffect, useRef, type ReactNode } from "react";

/* ---------- Numbers that count up ---------- */

export function CountUp({ value, className }: { value: number | undefined | null; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    if (value == null || !ref.current) return;
    const from = prev.current;
    prev.current = value;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000);
      if (ref.current) ref.current.textContent = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref} className={className}>{value == null ? "–" : "0"}</span>;
}

/* ---------- Layout ---------- */

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}

export function Card({ title, extra, className, children, delay = 0 }: { title?: ReactNode; extra?: ReactNode; className?: string; children: ReactNode; delay?: number }) {
  return (
    <section className={clsx("card", className)} style={{ animationDelay: `${delay}ms` }}>
      {title && (
        <h3>
          {title}
          {extra && <small>{extra}</small>}
        </h3>
      )}
      {children}
    </section>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

/* ---------- Charts (plain SVG) ---------- */

export function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <svg className="spark" />;
  const w = 200, h = 34, max = Math.max(...points), min = Math.min(...points);
  const d = points.map((p, i) => `${i ? "L" : "M"}${(i / (points.length - 1)) * w},${h - 4 - ((p - min) / (max - min || 1)) * (h - 8)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={d} />
    </svg>
  );
}

export function AreaChart({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 400, h = 120, max = Math.max(1, ...points);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - (p / max) * (h - 16)]);
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const cx = (xy[i - 1][0] + xy[i][0]) / 2;
    d += ` C${cx},${xy[i - 1][1]} ${cx},${xy[i][1]} ${xy[i][0]},${xy[i][1]}`;
  }
  return (
    <svg className="area-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path className="area" d={`${d} L${w},${h} L0,${h}Z`} />
      <path className="ln" d={d} />
    </svg>
  );
}

export function BarChart({ data }: { data: { label: string; a: number; b?: number }[] }) {
  const W = 520, H = 196, base = 170, gap = (W - 30) / Math.max(1, data.length);
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b ?? 0)));
  const scale = (v: number) => (v / max) * 150;
  return (
    <svg className="bar-chart" viewBox={`0 0 ${W} ${H}`}>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="24" x2={W} y1={base - i * 50} y2={base - i * 50} />
      ))}
      {data.map((d, i) => {
        const pair = d.b != null;
        const x = 30 + i * gap + gap / 2 - (pair ? 20 : 9);
        return (
          <g key={d.label + i}>
            <rect x={x} y={base - scale(d.a)} width="18" height={scale(d.a)} rx="6" className="a" style={{ animationDelay: `${i * 60}ms` }}>
              <title>{`${d.label}: ${d.a}`}</title>
            </rect>
            {pair && (
              <rect x={x + 22} y={base - scale(d.b!)} width="18" height={scale(d.b!)} rx="6" className="b" style={{ animationDelay: `${i * 60 + 30}ms` }}>
                <title>{`${d.label}: ${d.b}`}</title>
              </rect>
            )}
            <text x={x + (pair ? 20 : 9)} y="190" textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Form fields ---------- */

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; wide?: boolean };

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, wide, className, ...rest }, ref) {
  return (
    <label className={clsx("inp", wide && "wide", className)}>
      {label}
      <input ref={ref} {...rest} />
      {hint}
    </label>
  );
});

export function SelectField({ label, children, className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={clsx("inp", className)}>
      {label}
      <select {...rest}>{children}</select>
    </label>
  );
}

/* ---------- Table ---------- */

export function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][] | null; empty: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows === null ? (
            <tr>
              <td colSpan={head.length} className="empty-cell">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="empty-cell">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* Coloured initials avatar; the colour is stable per name. */
const AV = ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#ef4444", "#0ea5e9"];
export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "?";
  const color = AV[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
  return (
    <span className="avatar-dot" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
