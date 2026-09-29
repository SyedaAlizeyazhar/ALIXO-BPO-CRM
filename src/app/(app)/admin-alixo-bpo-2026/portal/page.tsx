"use client";

import clsx from "clsx";
import { Ban, Check, KeyRound, Link2, PhoneCall, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/Toasts";
import { Avatar, Card, Empty, Field, PageHead, SelectField, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { PALETTES } from "@/lib/config";
import type { Agent, AgentStatus } from "@/lib/types";
import { fmtTime } from "@/lib/util";

type Filter = "Pending" | "Approved" | "Inactive" | "All";
type Settings = { defaultCallbackUrl?: string; defaultPalette?: string; defaultMode?: string };

const STATUS_CLASS: Record<AgentStatus, string> = { Pending: "warn", Approved: "ok", Rejected: "dup", Disabled: "dup" };

function CallbackDialog({ agent, defaultUrl, onClose, onSave }: {
  agent: Agent; defaultUrl: string; onClose: () => void; onSave: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(agent.callbackUrl);
  const [busy, setBusy] = useState(false);
  const save = async (v: string) => {
    setBusy(true);
    try { await onSave(v); onClose(); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Callback access for ${agent.name}`}>
        <h3>Callback sheet · {agent.name}</h3>
        <p className="muted small">
          Paste the Google Sheet <b>viewer</b> link this agent should call back from. Share the sheet as &ldquo;Anyone with the link · Viewer&rdquo; in Google Sheets first.
        </p>
        <Field label="Google Sheet link" placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={() => save(url.trim())}><Save size={16} /> Save</button>
          {defaultUrl && <button className="btn ghost" disabled={busy} onClick={() => save(defaultUrl)}>Use default sheet</button>}
          {agent.callbackUrl && <button className="btn ghost danger" disabled={busy} onClick={() => save("")}><X size={16} /> Remove access</button>}
        </div>
      </div>
    </div>
  );
}

function SheetSyncCard() {
  const toast = useToast();
  const { data } = useSWR<{ configured: boolean }>("/api/admin/sync", api.get);
  const [busy, setBusy] = useState(false);
  const sync = async () => {
    setBusy(true);
    try {
      const r = await api.send<{ leads: number; agents: number }>("/api/admin/sync", "POST", {});
      toast(`Sheet updated — ${r.leads} leads, ${r.agents} agents`, "ok");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={<>Google Sheet copy {data && <span className={`chip ${data.configured ? "" : "warn"}`}>{data.configured ? "Connected" : "Not set up"}</span>}</>} delay={60}>
      <p className="muted small">
        Every new lead and agent change is copied to the sheet automatically. Data lives in the database; the sheet is a copy for viewing and sharing.
        {data && !data.configured && <> Add <b>SHEET_WEBHOOK_URL</b> and <b>SHEET_WEBHOOK_SECRET</b> on Vercel to turn it on.</>}
      </p>
      <button className="btn" disabled={busy || !data?.configured} onClick={sync}>
        <RefreshCw size={16} /> {busy ? "Syncing…" : "Sync sheet now"}
      </button>
      <p className="hint" style={{ marginTop: 10 }}>Rewrites the Leads and Agents tabs with everything in the database.</p>
    </Card>
  );
}

function SettingsCard() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ settings: Settings }>("/api/admin/settings", api.get);
  const [s, setS] = useState<Settings>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data.settings); }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await api.send("/api/admin/settings", "PUT", {
        defaultCallbackUrl: s.defaultCallbackUrl ?? "",
        defaultPalette: s.defaultPalette || "aurora",
        defaultMode: s.defaultMode || "light",
      });
      toast("Settings saved", "ok");
      mutate();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Settings" delay={80}>
      <div className="fields one">
        <Field label="Default callback sheet (viewer link)" placeholder="https://docs.google.com/spreadsheets/d/…"
          value={s.defaultCallbackUrl ?? ""} onChange={(e) => setS({ ...s, defaultCallbackUrl: e.target.value })}
          hint={<span className="hint">Used by &ldquo;Use default sheet&rdquo; when giving an agent access.</span>} />
        <div className="two">
          <SelectField label="Default colour" value={s.defaultPalette || "aurora"} onChange={(e) => setS({ ...s, defaultPalette: e.target.value })}>
            {PALETTES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <SelectField label="Default mode" value={s.defaultMode || "light"} onChange={(e) => setS({ ...s, defaultMode: e.target.value })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectField>
        </div>
        <p className="hint">Agents who haven&apos;t picked their own theme see the default.</p>
        <button className="btn" disabled={busy} onClick={save}><Save size={16} /> {busy ? "Saving…" : "Save settings"}</button>
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ agents: Agent[] }>("/api/admin/agents", api.get, { refreshInterval: 30_000 });
  const settings = useSWR<{ settings: Settings }>("/api/admin/settings", api.get);
  const [filter, setFilter] = useState<Filter>("Pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);

  const agents = data?.agents ?? [];
  const counts = {
    Pending: agents.filter((a) => a.status === "Pending").length,
    Approved: agents.filter((a) => a.status === "Approved").length,
    Inactive: agents.filter((a) => a.status === "Rejected" || a.status === "Disabled").length,
    All: agents.length,
  };
  const shown = agents
    .filter((a) => filter === "All" || (filter === "Inactive" ? a.status === "Rejected" || a.status === "Disabled" : a.status === filter))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  // A filter that just emptied (e.g. last pending approved) falls back to Approved.
  useEffect(() => {
    if (data && filter === "Pending" && counts.Pending === 0 && counts.Approved > 0) setFilter("Approved");
  }, [data, filter, counts.Pending, counts.Approved]);

  async function update(a: Agent, patch: Record<string, unknown>, done: string) {
    setBusy(a.username);
    try {
      const res = await api.send<{ tempPassword?: string }>("/api/admin/agents", "PATCH", { username: a.username, ...patch });
      if (res.tempPassword) setTemp({ name: a.name, password: res.tempPassword });
      toast(done, "ok");
      await mutate();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  }

  const actions = (a: Agent) => {
    const off = busy === a.username;
    return (
      <span className="row-actions">
        {a.status !== "Approved" && (
          <button className="btn sm" disabled={off} onClick={() => update(a, { status: "Approved" }, `${a.name} approved`)}><Check size={15} /> Approve</button>
        )}
        {a.status === "Pending" && (
          <button className="btn ghost sm danger" disabled={off} onClick={() => update(a, { status: "Rejected" }, `${a.name} rejected`)}><X size={15} /> Reject</button>
        )}
        {a.status === "Approved" && (
          <>
            <button className="btn ghost sm" disabled={off} onClick={() => setEditing(a)} title="Callback sheet access"><PhoneCall size={15} /> Callbacks</button>
            <button className="btn ghost sm" disabled={off} title="Reset password"
              onClick={() => confirm(`Reset ${a.name}'s password? Their old password will stop working.`) && update(a, { resetPassword: true }, "Password reset")}>
              <KeyRound size={15} />
            </button>
            <button className="btn ghost sm danger" disabled={off} title="Disable account"
              onClick={() => confirm(`Disable ${a.name}? They won't be able to log in.`) && update(a, { status: "Disabled" }, `${a.name} disabled`)}>
              <Ban size={15} />
            </button>
          </>
        )}
        {(a.status === "Disabled" || a.status === "Rejected") && (
          <button className="btn ghost sm" disabled={off} onClick={() => update(a, { status: "Pending" }, `${a.name} moved to pending`)}><RotateCcw size={15} /></button>
        )}
      </span>
    );
  };

  return (
    <>
      <PageHead title="Admin Portal" sub="Approve new agents and control who can see the callback sheet" />

      <div className="stat-row">
        {(["Pending", "Approved", "Inactive", "All"] as Filter[]).map((f, i) => (
          <Card key={f} className={clsx("stat clickable", filter === f && "hot")} delay={i * 50}>
            <button className="stat-btn" onClick={() => setFilter(f)}>
              <span className="n">{data ? counts[f] : "–"}</span>
              <span className="l">{f === "All" ? "All agents" : f === "Inactive" ? "Rejected / disabled" : f}</span>
            </button>
          </Card>
        ))}
      </div>

      <div className="admin-layout">
        <Card title={`${filter === "All" ? "All" : filter} agents`} extra={error ? <span className="bad-text">{error.message}</span> : undefined}>
          {data && shown.length === 0 ? (
            <Empty>{filter === "Pending" ? "No sign-ups waiting for approval." : "No agents here."}</Empty>
          ) : (
            <Table
              head={["Agent", "Status", "Callbacks", "Signed up", "Last login", ""]}
              empty="No agents."
              rows={
                data
                  ? shown.map((a) => [
                      <span className="who" key="a"><Avatar name={a.name} size={32} /><span><b>{a.name}</b><small className="muted">@{a.username}</small></span></span>,
                      <span key="s" className={`st ${STATUS_CLASS[a.status]}`}>{a.status}</span>,
                      a.callbackUrl ? <span key="c" className="st ok"><Link2 size={12} /> Access</span> : <span key="c" className="muted small">—</span>,
                      a.createdAt ? fmtTime(a.createdAt) : "—",
                      a.lastLogin ? fmtTime(a.lastLogin) : "Never",
                      actions(a),
                    ])
                  : error
                    ? []
                    : null
              }
            />
          )}
        </Card>
        <div className="admin-side">
          <SheetSyncCard />
          <SettingsCard />
        </div>
      </div>

      {editing && (
        <CallbackDialog
          agent={editing}
          defaultUrl={settings.data?.settings.defaultCallbackUrl ?? ""}
          onClose={() => setEditing(null)}
          onSave={(url) => update(editing, { callbackUrl: url }, url ? `Callback access given to ${editing.name}` : `Callback access removed`)}
        />
      )}

      {temp && (
        <div className="modal-bg" onClick={() => setTemp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Temporary password">
            <h3>New password for {temp.name}</h3>
            <p className="muted small">Share this with the agent now — it won&apos;t be shown again.</p>
            <p className="temp-pw mono">{temp.password}</p>
            <div className="btn-row">
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(temp.password); toast("Password copied", "ok"); }}>Copy</button>
              <button className="btn ghost" onClick={() => setTemp(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
