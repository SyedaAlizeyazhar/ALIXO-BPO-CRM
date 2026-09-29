"use client";

import { AlertTriangle, CalendarDays, CalendarRange, Copy, PhoneCall, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaChart, Avatar, BarChart, Card, CountUp, Empty, Spark, Table } from "@/components/ui";
import { useCampaigns, useMe, useSheet } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { digits, fmtTime, maskPhone } from "@/lib/util";

const MEDALS = ["🥇", "🥈", "🥉"];

function trend(now: number, before: number) {
  if (!before) return now ? "New" : "—";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}

function QuickDupe() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  return (
    <form
      className="dupebox"
      onSubmit={(e) => {
        e.preventDefault();
        const d = digits(phone);
        if (d.length === 10) router.push(`/dupe?phone=${d}`);
      }}
    >
      <input className="plain" placeholder="(555) 555-5555" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} aria-label="Phone number" />
      <button className="btn">Check</button>
    </form>
  );
}

export default function Dashboard() {
  const { data: me } = useMe();
  const { data, error } = useSheet<DashboardStats>("getDashboardStats");
  const { active: activeCampaigns } = useCampaigns();
  const isMe = (name: string) => !!me && me.role === "agent" && name.trim().toLowerCase() === me.name.trim().toLowerCase();
  const isAgent = me?.role === "agent";
  const daily = data?.daily ?? [];
  const week = daily.slice(-7);

  // Agents see their own numbers in the hero; the admin sees the whole floor.
  const heroToday = isAgent ? data?.mine.today : data?.todayLeads;
  const heroYesterday = isAgent ? data?.mine.yesterday : data?.yesterdayLeads;
  const heroSeries = daily.map((d) => (isAgent ? d.mine : d.total));

  return (
    <>
      {error && (
        <div className="banner bad">
          <AlertTriangle size={18} /> {error.message}
        </div>
      )}

      <div className="row1">
        <Card className="hero">
          <div className="lbl">{isAgent ? "Your leads today" : "Floor leads today"}</div>
          <CountUp className="big" value={heroToday} />
          <div className="sub">
            <span className="chip light">{data ? trend(heroToday ?? 0, heroYesterday ?? 0) : "…"}</span> vs yesterday
          </div>
          <AreaChart points={heroSeries.length ? heroSeries : [0, 0]} />
        </Card>

        <Card className="mini" delay={80}>
          <span className="ic"><CalendarDays size={20} /></span>
          <CountUp className="n" value={isAgent ? data?.mine.week : data?.weekLeads} />
          <div className="l">{isAgent ? "Your week" : "This week"} <span className="chip">Mon–Sun</span></div>
          <Spark points={week.map((d) => (isAgent ? d.mine : d.total))} />
        </Card>
        <Card className="mini" delay={160}>
          <span className="ic"><CalendarRange size={20} /></span>
          <CountUp className="n" value={isAgent ? data?.mine.month : data?.monthLeads} />
          <div className="l">{isAgent ? "Your month" : "This month"}</div>
          <Spark points={daily.map((d) => (isAgent ? d.mine : d.total))} />
        </Card>
        <Card className="mini" delay={240}>
          <span className="ic"><Copy size={20} /></span>
          <CountUp className="n" value={data?.duplicateLeads} />
          <div className="l">Duplicates <span className="chip warn">all-time</span></div>
          <Spark points={daily.map((d) => d.dupes)} />
        </Card>
      </div>

      <div className="row2">
        <Card title="Leads — last 7 days" extra={isAgent ? "Floor · You" : "Floor total"} delay={260}>
          {data ? (
            <BarChart
              data={week.map((d) => ({
                label: new Date(d.day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
                a: d.total,
                b: isAgent ? d.mine : undefined,
              }))}
            />
          ) : (
            <Empty>{error ? "No data." : "Loading…"}</Empty>
          )}
        </Card>
        <Card title="Top agents" extra="this month" delay={320}>
          {data?.topAgents?.length ? (
            <div className="agents">
              {data.topAgents.slice(0, 5).map((a, i) => (
                <div key={a.agentName} className={`agent ${isMe(a.agentName) ? "me" : ""}`}>
                  <span className="medal">{MEDALS[i] ?? i + 1}</span>
                  <Avatar name={a.agentName} size={38} />
                  <div>
                    <b>{a.agentName}</b>
                    <span>{isMe(a.agentName) ? "That's you!" : "Agent"}</span>
                  </div>
                  <div className="score">
                    <b>{a.count}</b>
                    <span> leads</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{data || error ? "No leads this month yet." : "Loading…"}</Empty>
          )}
        </Card>
      </div>

      <div className="row3">
        <Card title={<>Recent submissions <span className="chip live">Live</span></>} extra={<Link href="/progress">View all →</Link>} delay={380}>
          <Table
            head={["Customer", "Agent", "Campaign", "State", "Time", "Status"]}
            empty="No leads submitted yet."
            rows={
              data
                ? data.recentLeads.map((r) => [
                    <span className="who" key="c"><Avatar name={`${r.firstName} ${r.lastName}`} size={28} />{r.firstName} {r.lastName}</span>,
                    r.agentName,
                    r.campaign,
                    r.state,
                    fmtTime(r.timestamp),
                    <span key="s" className={`st ${r.duplicate ? "dup" : "ok"}`}>{r.duplicate ? "Duplicate" : "Submitted"}</span>,
                  ])
                : error
                  ? []
                  : null
            }
          />
        </Card>
        <div className="stack">
          <Card title="Quick actions" delay={440}>
            <Link href="/leads" className="btn full"><Send size={17} /> Submit a lead</Link>
            <p className="sub-h">Dupe check</p>
            <QuickDupe />
          </Card>
          {me?.callbackUrl && (
            <Card title={<>Callbacks <span className="chip live">Access</span></>} delay={500}>
              <p className="muted small">Your admin has shared the callback sheet with you.</p>
              <Link href="/callbacks" className="btn ghost full"><PhoneCall size={17} /> Open callbacks</Link>
            </Card>
          )}
          <Card title="Active campaigns" extra={`${activeCampaigns.length} live`} delay={560}>
            <div className="camp-mini">
              {activeCampaigns.slice(0, 4).map((c) => {
                const n = data?.campaignPerformance[c.name] ?? 0;
                return (
                  <div key={c.id}>
                    <div className="row"><span>{c.name}</span><b>{n}/{c.target}</b></div>
                    <div className="bar"><span style={{ width: `${c.target > 0 ? Math.min(100, (n / c.target) * 100) : 0}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <Link href="/campaigns" className="link-sm">All campaigns →</Link>
          </Card>
        </div>
      </div>
    </>
  );
}
