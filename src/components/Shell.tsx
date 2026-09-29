"use client";

import clsx from "clsx";
import {
  Bell, ChevronDown, LayoutDashboard, LogOut, Megaphone, Menu, Moon, Palette, PhoneCall, Search,
  SearchCheck, Send, ShieldCheck, Sun, TrendingUp, Wrench, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api, useMe, useSheet } from "@/lib/api";
import { activeCampaigns, ADMIN_PATH, ADMIN_PORTAL, PALETTES } from "@/lib/config";
import type { Agent, DashboardStats } from "@/lib/types";
import { digits, TZ } from "@/lib/util";
import { Logo } from "./Logo";
import { useTheme } from "./Theme";
import { Avatar } from "./ui";

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [open, close]);
  return ref;
}

function Clock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET");
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);
  return <>{now}</>;
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function ThemeControls() {
  const { palette, mode, setPalette, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  return (
    <>
      <div className="pop-wrap" ref={ref}>
        <button className="ib" title="Colour theme" aria-label="Colour theme" onClick={() => setOpen((o) => !o)}>
          <Palette size={19} />
        </button>
        {open && (
          <div className="pop palette-pop">
            <p>Colour theme</p>
            <div className="swatches">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  title={p.name}
                  aria-label={p.name}
                  className={clsx(palette === p.id && "on")}
                  style={{ background: `linear-gradient(135deg, ${p.a}, ${p.b})` }}
                  onClick={() => { setPalette(p.id); setOpen(false); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="ib" title={mode === "dark" ? "Light mode" : "Dark mode"} aria-label="Toggle light / dark" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
        {mode === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    </>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace(role === "admin" ? ADMIN_PATH : "/login");
  };
  return (
    <div className="pop-wrap" ref={ref}>
      <button className="user-btn" onClick={() => setOpen((o) => !o)}>
        <Avatar name={name} size={36} />
        <span className="user-meta">
          <b>{name}</b>
          <small>{role === "admin" ? "Admin" : "Agent"}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="pop user-pop">
          <button onClick={logout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const { data: me } = useMe();
  const stats = useSheet<DashboardStats>("getDashboardStats");
  const isAdmin = me?.role === "admin";
  const pending = useSWR<{ agents: Agent[] }>(isAdmin ? "/api/admin/agents" : null, api.get, { refreshInterval: 60_000 });
  const pendingCount = pending.data?.agents?.filter((a) => a.status === "Pending").length ?? 0;

  useEffect(() => setDrawer(false), [pathname]);

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Lead Submission", icon: Send },
    { href: "/dupe", label: "Dupe Checker", icon: SearchCheck },
    { href: "/campaigns", label: "Active Campaigns", icon: Megaphone, badge: activeCampaigns.length },
    ...(me?.callbackUrl || isAdmin ? [{ href: "/callbacks", label: "Callbacks", icon: PhoneCall }] : []),
    { href: "/progress", label: "Progress", icon: TrendingUp },
    { href: "/tools", label: "Tools", icon: Wrench },
  ];

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const d = digits(q);
    if (d.length >= 10) router.push(`/dupe?phone=${d.slice(-10)}`);
  };

  const sheetOk = !!stats.data && !stats.error;

  return (
    <div className="app">
      <div className="fx" aria-hidden="true"><i /><i /><i /></div>

      <aside className={clsx("side", drawer && "open")}>
        <div className="side-top">
          <Link href="/"><Logo /></Link>
          <button className="ib close-drawer" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={18} /></button>
        </div>
        <p className="navlbl">Menu</p>
        <nav className="nav">
          {nav.map(({ href, label, icon: Icon, badge }) => (
            <Link key={href} href={href} className={clsx(pathname === href && "on")}>
              <Icon size={19} />
              {label}
              {badge ? <span className="badge">{badge}</span> : null}
            </Link>
          ))}
        </nav>
        {isAdmin && (
          <>
            <p className="navlbl">Admin</p>
            <nav className="nav">
              <Link href={ADMIN_PORTAL} className={clsx(pathname.startsWith(ADMIN_PORTAL) && "on")}>
                <ShieldCheck size={19} />
                Admin Portal
                {pendingCount > 0 && <span className="badge warn">{pendingCount}</span>}
              </Link>
            </nav>
          </>
        )}
        <div className="side-foot">
          <span className={clsx("dot", sheetOk ? "ok" : stats.error ? "bad" : "wait")} />
          <div>
            <b>{sheetOk ? "Sheet connected" : stats.error ? "Sheet not reachable" : "Connecting…"}</b>
            <span>{stats.error ? stats.error.message.slice(0, 60) : `Auto-refresh every 20s`}</span>
          </div>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <div className="content">
        <header className="top">
          <button className="ib menu-btn" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={20} /></button>
          <div className="greet">
            <h2>{greeting()}, {me?.name?.split(" ")[0] ?? "…"} 👋</h2>
            <p><Clock /></p>
          </div>
          <form className="search" onSubmit={onSearch}>
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dupe check a phone number…" inputMode="tel" aria-label="Dupe check a phone number" />
          </form>
          <ThemeControls />
          {isAdmin && (
            <Link href={ADMIN_PORTAL} className="ib" title="Pending approvals" aria-label="Pending approvals">
              <Bell size={19} />
              {pendingCount > 0 && <span className="ib-dot" />}
            </Link>
          )}
          {me && <UserMenu name={me.name} role={me.role} />}
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
