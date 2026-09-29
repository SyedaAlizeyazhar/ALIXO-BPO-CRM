"use client";

import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toasts";
import { Avatar, Card, CountUp, Empty, Field, PageHead, SelectField, Table } from "@/components/ui";
import { refreshAllSheets, useSheet } from "@/lib/api";
import type { AgentCount, Lead, ProgressStats, Range } from "@/lib/types";
import { fmtPhone, fmtTime } from "@/lib/util";

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "lastmonth", label: "Last month" },
  { id: "custom", label: "Custom" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ProgressPage() {
  const toast = useToast();
  const [range, setRange] = useState<Range>("today");
  const [agent, setAgent] = useState("");
  const [draft, setDraft] = useState({ start: "", end: "" });
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);

  // A custom range only queries once both dates are applied.
  const waiting = range === "custom" && !custom;
  const rangeParams = { range, ...(range === "custom" && custom ? custom : {}) };

  const stats = useSheet<ProgressStats>(waiting ? null : "getProgress", { ...rangeParams, agent });
  const byAgent = useSheet<{ agents: AgentCount[] }>(waiting ? null : "getAgentLeads", rangeParams);
  const today = useSheet<{ leads: Lead[] }>("getTodayLeads");
  const top = useSheet<{ agents: AgentCount[] }>("getTopAgents");
  const allAgents = useSheet<{ agents: AgentCount[] }>("getTopAgents", { all: "true" }, false);

  const rangeLabel = RANGES.find((r) => r.id === range)!.label;
  const agents = byAgent.data?.agents ?? [];
  const maxCount = Math.max(1, ...agents.map((a) => a.count));
  const podium = (top.data?.agents ?? []).slice(0, 3);

  return (
    <>
      <PageHead title="Progress" sub="Leads by day, week and month — per agent or the whole floor">
        <button className="btn ghost" onClick={() => refreshAllSheets()}><RefreshCw size={16} /> Refresh</button>
      </PageHead>

      <Card className="controls">
        <div className="seg" role="tablist">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} className={clsx(range === r.id && "on")} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <SelectField label="Agent" value={agent} onChange={(e) => setAgent(e.target.value)} className="agent-filter">
          <option value="">All agents</option>
          {(allAgents.data?.agents ?? []).map((a) => (
            <option key={a.agentName} value={a.agentName}>{a.agentName}</option>
          ))}
        </SelectField>
        {range === "custom" && (
          <div className="custom-range">
            <Field label="Start" type="date" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
            <Field label="End" type="date" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
            <button
              className="btn"
              onClick={() => {
                if (!draft.start || !draft.end) return toast("Pick both a start and end date.", "bad");
                if (draft.start > draft.end) return toast("Start date is after end date.", "bad");
                setCustom({ ...draft });
              }}
            >
              Apply
            </button>
          </div>
        )}
      </Card>

      <div className="stat-row">
        {[
          { v: stats.data?.rangeLeads, l: agent ? `${rangeLabel} · ${agent}` : rangeLabel, hot: true },
          { v: stats.data?.todayLeads, l: "Today" },
          { v: stats.data?.weekLeads, l: "This week" },
          { v: stats.data?.monthLeads, l: "This month" },
          { v: stats.data?.totalLeads, l: "All-time" },
        ].map((s, i) => (
          <Card key={i} className={clsx("stat", s.hot && "hot")} delay={i * 50}>
            <CountUp className="n" value={waiting ? null : s.v} />
            <span className="l">{s.l}</span>
          </Card>
        ))}
      </div>
      {stats.error && <p className="form-msg bad">{stats.error.message}</p>}

      <div className="row2">
        <Card title="Top 3 agents" extra="this month" delay={120}>
          {podium.length ? (
            <div className="podium">
              {[1, 0, 2].filter((i) => podium[i]).map((i) => (
                <div key={podium[i].agentName} className={`pillar p${i + 1}`}>
                  <span className="medal">{MEDALS[i]}</span>
                  <Avatar name={podium[i].agentName} size={46} />
                  <b>{podium[i].agentName}</b>
                  <span className="muted small">{podium[i].count} leads</span>
                  <span className="block">#{i + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{top.data || top.error ? "No leads this month yet." : "Loading…"}</Empty>
          )}
        </Card>
        <Card title="Leads by agent" extra={rangeLabel} delay={180}>
          <div className="hbars">
            {waiting ? (
              <Empty>Pick a start and end date, then Apply.</Empty>
            ) : agents.length ? (
              agents.map((a) => (
                <div key={a.agentName} className="hbar">
                  <span className="who"><Avatar name={a.agentName} size={26} />{a.agentName}</span>
                  <span className="bar"><span style={{ width: `${(a.count / maxCount) * 100}%` }} /></span>
                  <b>{a.count}</b>
                </div>
              ))
            ) : (
              <Empty>{byAgent.data || byAgent.error ? "No leads for this range." : "Loading…"}</Empty>
            )}
          </div>
        </Card>
      </div>

      <Card title="Today's leads" extra={today.data ? `${today.data.leads.length} so far` : undefined} delay={240}>
        <Table
          head={["Time", "Agent", "Customer", "Phone", "Campaign", "State", "Transfer by", "Duration"]}
          empty="No leads submitted today yet."
          rows={
            today.data
              ? today.data.leads.map((r) => [
                  fmtTime(r.timestamp),
                  r.agentName,
                  `${r.firstName} ${r.lastName}`,
                  <span className="mono" key="p">{fmtPhone(r.phone)}</span>,
                  r.campaign,
                  r.state,
                  r.transferBy,
                  r.duration,
                ])
              : today.error
                ? []
                : null
          }
        />
      </Card>
    </>
  );
}
