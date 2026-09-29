"use client";

import { Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/Toasts";
import { Avatar, Card, PageHead, Table } from "@/components/ui";
import { api, refreshAllSheets } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { fmtPhone, fmtTime } from "@/lib/util";

/* Admin: find any lead and delete it (also removed from the Google Sheet copy). */
export default function ManageLeadsPage() {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const { data, error, isLoading, mutate } = useSWR<{ leads: Lead[] }>(`/api/admin/leads?q=${encodeURIComponent(q)}`, api.get);

  // Search as you type, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  async function remove(l: Lead) {
    const who = `${l.firstName} ${l.lastName}`.trim() || fmtPhone(l.phone);
    if (!confirm(`Delete this lead?\n\n${who} · ${l.campaign}\n${fmtTime(l.timestamp)} · by ${l.agentName}\n\nThis can't be undone.`)) return;
    setBusy(l.id!);
    try {
      const res = await fetch(`/api/admin/leads?id=${l.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      toast("Lead deleted", "ok");
      await mutate();
      refreshAllSheets();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  }

  const leads = data?.leads ?? [];

  return (
    <>
      <PageHead title="Manage leads" sub="Search by phone number, customer, agent or campaign. Deleting also removes the lead from the Google Sheet." />

      <Card className="controls">
        <label className="search big-search">
          <Search size={18} />
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. 5555550100, John Smith, OWAIS, MED CPL…" aria-label="Search leads" />
        </label>
      </Card>

      <Card title={q ? `Results for “${q}”` : "Latest leads"} extra={data ? `${leads.length}${leads.length === 100 ? "+" : ""} shown` : undefined}>
        <Table
          head={["Customer", "Phone", "Agent", "Campaign", "State", "Submitted", "Status", ""]}
          empty={q ? "No leads match this search." : "No leads yet."}
          rows={
            data
              ? leads.map((l) => [
                  <span className="who" key="c"><Avatar name={`${l.firstName} ${l.lastName}`} size={28} />{l.firstName} {l.lastName}</span>,
                  <span className="mono" key="p">{fmtPhone(l.phone)}</span>,
                  l.agentName,
                  l.campaign,
                  l.state,
                  fmtTime(l.timestamp),
                  <span key="s" className={`st ${l.duplicate ? "dup" : "ok"}`}>{l.duplicate ? "Duplicate" : "Original"}</span>,
                  <button key="d" className="btn ghost sm danger" disabled={busy === l.id} onClick={() => remove(l)} title="Delete lead" aria-label="Delete lead">
                    <Trash2 size={15} /> {busy === l.id ? "Deleting…" : "Delete"}
                  </button>,
                ])
              : error || !isLoading
                ? []
                : null
          }
        />
        {error && <p className="form-msg bad">{error.message}</p>}
      </Card>
    </>
  );
}
