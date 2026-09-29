"use client";

import clsx from "clsx";
import { CircleAlert, CircleCheck, SearchCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Avatar, Card, PageHead, Table } from "@/components/ui";
import { sheetGet } from "@/lib/api";
import type { DupeResult } from "@/lib/types";
import { digits, fmtPhone, fmtTime, maskPhone } from "@/lib/util";

type Verdict = { kind: "ok" | "bad" | "warn"; text: string } | null;

function DupeChecker() {
  const params = useSearchParams();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [result, setResult] = useState<DupeResult | null>(null);

  const scan = useCallback(async (raw: string) => {
    const d = digits(raw);
    if (d.length !== 10) return setVerdict({ kind: "warn", text: "Enter a full 10-digit phone number." });
    setBusy(true);
    setVerdict(null);
    setResult(null);
    try {
      const r = await sheetGet<DupeResult>("checkDuplicate", { phone: d });
      setResult(r);
      setVerdict(
        r.matches.length
          ? { kind: "bad", text: `${r.matches.length} prior submission${r.matches.length > 1 ? "s" : ""} found for ${fmtPhone(d)}` }
          : { kind: "ok", text: `${fmtPhone(d)} is clear — never submitted before` },
      );
    } catch (e) {
      setVerdict({ kind: "warn", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, []);

  // Arriving from the top search bar: /dupe?phone=5555550100
  useEffect(() => {
    const p = params.get("phone");
    if (p) {
      setPhone(maskPhone(p));
      scan(p);
    }
  }, [params, scan]);

  const Icon = verdict?.kind === "ok" ? CircleCheck : CircleAlert;

  return (
    <>
      <PageHead title="Dupe Checker" sub="Check a number before you transfer. This never blocks a submission — some customers qualify for more than one campaign." />

      <Card className="dupe-hero">
        <form onSubmit={(e) => { e.preventDefault(); scan(phone); }} className="dupe-form">
          <span className="ic big"><SearchCheck size={26} /></span>
          <input className="plain big" placeholder="(555) 555-5555" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} autoFocus aria-label="Customer phone number" />
          <button className="btn big" disabled={busy}>{busy ? "Checking…" : "Check number"}</button>
        </form>
        {verdict && (
          <p className={clsx("verdict", verdict.kind)} role="status">
            <Icon size={20} /> {verdict.text}
          </p>
        )}
      </Card>

      {result && result.matches.length > 0 && (
        <Card title="Previous submissions" delay={80}>
          <Table
            head={["Customer", "Agent", "Campaign", "State", "Submitted"]}
            empty="No matches."
            rows={result.matches.map((m) => [
              <span className="who" key="c"><Avatar name={`${m.firstName} ${m.lastName}`} size={28} />{m.firstName} {m.lastName}</span>,
              m.agentName,
              m.campaign,
              m.state,
              fmtTime(m.timestamp),
            ])}
          />
        </Card>
      )}
    </>
  );
}

export default function DupePage() {
  return (
    <Suspense>
      <DupeChecker />
    </Suspense>
  );
}
