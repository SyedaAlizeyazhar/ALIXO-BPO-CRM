"use client";

import { Clock, Coffee, Copy, ExternalLink, MapPin, Send, UserRound } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toasts";
import { Card, PageHead } from "@/components/ui";
import { useCampaigns, useSheet } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

export default function CampaignsPage() {
  const toast = useToast();
  const { data } = useSheet<DashboardStats>("getDashboardStats");
  const perf = data?.campaignPerformance ?? {};
  const { active: activeCampaigns, loading } = useCampaigns();

  return (
    <>
      <PageHead title="Active Campaigns" sub={loading ? "Loading…" : `${activeCampaigns.length} campaigns live · today's count updates automatically`} />
      {!loading && activeCampaigns.length === 0 && <Card><p className="muted">No active campaigns right now.</p></Card>}
      <div className="camp-grid">
        {activeCampaigns.map((c, i) => {
          const n = perf[c.name] ?? 0;
          const pct = c.target > 0 ? Math.min(100, Math.round((n / c.target) * 100)) : 0;
          return (
            <Card key={c.id} className="camp" delay={i * 50}>
              <div className="camp-head">
                <span className="chip live">Active</span>
                <span className="muted small">{c.type}</span>
              </div>
              <h4>{c.name}</h4>
              <div className="did">
                <span className="mono">{c.did}</span>
                {c.did !== "PING" && (
                  <button className="ib sm" title="Copy DID" aria-label="Copy DID"
                    onClick={() => { navigator.clipboard?.writeText(c.did); toast(`DID copied: ${c.did}`, "ok"); }}>
                    <Copy size={15} />
                  </button>
                )}
              </div>
              <ul className="facts">
                <li><Clock size={15} /> {c.timing}</li>
                <li><Coffee size={15} /> {c.breakTime}</li>
                <li><UserRound size={15} /> Age {c.ageLimit}</li>
                <li><MapPin size={15} /> {c.states}</li>
              </ul>
              {c.dqNotes && <p className="dq">DQ · {c.dqNotes}</p>}
              <div className="meter">
                <div className="row"><span>Today</span><b>{n} / {c.target}</b></div>
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="camp-actions">
                <Link className="btn sm" href={`/leads?campaign=${encodeURIComponent(c.name)}`}><Send size={15} /> Submit lead</Link>
                {c.formLink && (
                  <a className="btn ghost sm" href={c.formLink} target="_blank" rel="noopener">Transfer form <ExternalLink size={14} /></a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
