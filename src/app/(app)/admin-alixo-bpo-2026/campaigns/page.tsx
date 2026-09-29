"use client";

import clsx from "clsx";
import { Pause, Pencil, Play, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toasts";
import { Card, Field, PageHead, SelectField } from "@/components/ui";
import { api, useCampaigns } from "@/lib/api";
import type { Campaign } from "@/lib/config";

type Draft = Omit<Campaign, "id" | "createdAt" | "target"> & { id?: string; target: string };

const EMPTY: Draft = {
  name: "", type: "Static", did: "", states: "", timing: "", breakTime: "NO BREAK",
  ageLimit: "", dqNotes: "", formLink: "", target: "0", status: "Active",
};

function CampaignForm({ initial, onClose, onSaved }: { initial: Draft; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.send("/api/admin/campaigns", "POST", { ...d, target: Number(d.target) || 0 });
      toast(d.id ? "Campaign updated" : "Campaign added", "ok");
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal wide-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} role="dialog" aria-label={d.id ? "Edit campaign" : "Add campaign"}>
        <h3>{d.id ? "Edit campaign" : "Add campaign"}</h3>
        <div className="fields">
          <Field label="Campaign name" wide value={d.name} onChange={set("name")} placeholder="e.g. FE 180 (BLIND TRANSFER) (ADO)" required autoFocus />
          <Field label="DID" value={d.did} onChange={set("did")} placeholder="8664349627 or PING" />
          <Field label="Type" value={d.type} onChange={set("type")} placeholder="Static" />
          <Field label="Timing" value={d.timing} onChange={set("timing")} placeholder="07:00 PM - 03:00 AM" />
          <Field label="Break" value={d.breakTime} onChange={set("breakTime")} placeholder="NO BREAK" />
          <Field label="Age limit" value={d.ageLimit} onChange={set("ageLimit")} placeholder="50-85" />
          <Field label="Daily target" type="number" min={0} value={d.target} onChange={set("target")} />
          <label className="inp wide">
            States
            <textarea className="paste" rows={2} value={d.states} onChange={set("states")}
              placeholder="Good States: AZ, FL, GA …   or   Bad States: NY, CA …   or   ALL STATES EXCEPT NYC" />
            <span className="hint">Start with “Bad States:” to block states, or “ALL STATES EXCEPT NYC”. Otherwise the list is the allowed states.</span>
          </label>
          <Field label="DQ notes" wide value={d.dqNotes} onChange={set("dqNotes")} placeholder="ORIGINAL NUMBER ONLY" />
          <Field label="Before-transfer form link" wide value={d.formLink} onChange={set("formLink")} placeholder="https://…" />
          <SelectField label="Status" value={d.status} onChange={set("status")}>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
          </SelectField>
        </div>
        {error && <p className="form-msg bad">{error}</p>}
        <div className="btn-row">
          <button className="btn" disabled={busy}><Save size={16} /> {busy ? "Saving…" : "Save campaign"}</button>
          <button type="button" className="btn ghost" onClick={onClose}><X size={16} /> Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* Admin: add, edit, pause or delete campaigns. Agents see changes within a couple of minutes. */
export default function ManageCampaignsPage() {
  const toast = useToast();
  const { all, loading, mutate, error } = useCampaigns();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const toDraft = (c: Campaign): Draft => ({ ...c, target: String(c.target) });

  async function toggle(c: Campaign) {
    setBusy(c.id);
    try {
      await api.send("/api/admin/campaigns", "POST", { ...c, status: c.status === "Active" ? "Paused" : "Active" });
      toast(`${c.name} ${c.status === "Active" ? "paused" : "activated"}`, "ok");
      await mutate();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: Campaign) {
    if (!confirm(`Delete the campaign “${c.name}”?\n\nLeads already submitted to it are kept. To stop it for now, use Pause instead.`)) return;
    setBusy(c.id);
    try {
      const res = await fetch(`/api/admin/campaigns?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      toast("Campaign deleted", "ok");
      await mutate();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead title="Manage campaigns" sub="Only Active campaigns appear on the lead form and the Active Campaigns page.">
        <button className="btn" onClick={() => setEditing({ ...EMPTY })}><Plus size={17} /> Add campaign</button>
      </PageHead>

      {error && <p className="form-msg bad">{error.message}</p>}
      {loading && <Card><p className="muted">Loading…</p></Card>}

      <div className="camp-grid">
        {all.map((c, i) => (
          <Card key={c.id} className={clsx("camp", c.status === "Paused" && "paused")} delay={i * 40}>
            <div className="camp-head">
              <span className={clsx("chip", c.status === "Active" ? "live" : "warn")}>{c.status}</span>
              <span className="muted small">Target {c.target}/day</span>
            </div>
            <h4>{c.name}</h4>
            <dl className="kv">
              <dt>DID</dt><dd className="mono">{c.did || "—"}</dd>
              <dt>Timing</dt><dd>{c.timing || "—"}</dd>
              <dt>Break</dt><dd>{c.breakTime || "—"}</dd>
              <dt>Age</dt><dd>{c.ageLimit || "—"}</dd>
              <dt>States</dt><dd>{c.states || "—"}</dd>
            </dl>
            {c.dqNotes && <p className="dq">DQ · {c.dqNotes}</p>}
            <div className="camp-actions">
              <button className="btn sm" disabled={busy === c.id} onClick={() => setEditing(toDraft(c))}><Pencil size={14} /> Edit</button>
              <button className="btn ghost sm" disabled={busy === c.id} onClick={() => toggle(c)}>
                {c.status === "Active" ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Activate</>}
              </button>
              <button className="btn ghost sm danger" disabled={busy === c.id} onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 size={14} /></button>
            </div>
          </Card>
        ))}
      </div>

      {editing && <CampaignForm initial={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />}
    </>
  );
}
