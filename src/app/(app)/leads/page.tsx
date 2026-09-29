"use client";

import clsx from "clsx";
import { CheckCircle2, CircleAlert, CircleDashed, ExternalLink, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toasts";
import { Card, Field, PageHead, SelectField } from "@/components/ui";
import { api, refreshAllSheets, sheetGet, useCampaigns, useMe } from "@/lib/api";
import type { DupeResult } from "@/lib/types";
import { digits, eligibility, fmtTime, isValidDob, maskDob, maskPhone } from "@/lib/util";

const EMPTY = {
  campaign: "",
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  showNumber: "",
  street: "",
  city: "",
  state: "",
  zipcode: "",
  transferBy: "",
  duration: "",
};
type Form = typeof EMPTY;

function LeadForm() {
  const toast = useToast();
  const params = useSearchParams();
  const { data: me } = useMe();
  const { active: activeCampaigns } = useCampaigns();
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "bad" | "warn" } | null>(null);
  const [armed, setArmed] = useState(false); // second press after a rule warning
  const [dupe, setDupe] = useState<{ res: DupeResult | null; loading: boolean } | null>(null);

  useEffect(() => {
    const wanted = params.get("campaign") ?? "";
    if (activeCampaigns.some((c) => c.name === wanted)) setF((x) => (x.campaign === wanted ? x : { ...x, campaign: wanted }));
  }, [params, activeCampaigns]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let v = e.target.value;
    if (k === "phone" || k === "showNumber") v = maskPhone(v);
    if (k === "dob") v = maskDob(v);
    if (k === "state") v = v.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
    if (k === "zipcode") v = digits(v).slice(0, 5);
    setF((x) => ({ ...x, [k]: v }));
    setArmed(false);
    if (msg?.kind !== "ok") setMsg(null);
  };

  // Non-blocking dupe lookup as soon as the phone number is complete.
  const phoneDigits = digits(f.phone);
  useEffect(() => {
    if (phoneDigits.length !== 10) { setDupe(null); return; }
    let live = true;
    setDupe({ res: null, loading: true });
    sheetGet<DupeResult>("checkDuplicate", { phone: phoneDigits })
      .then((res) => live && setDupe({ res, loading: false }))
      .catch(() => live && setDupe(null));
    return () => { live = false; };
  }, [phoneDigits]);

  const campaign = activeCampaigns.find((c) => c.name === f.campaign);
  const checks = useMemo(() => (campaign ? eligibility(campaign, f) : []), [campaign, f]);
  const failing = checks.filter((c) => c.ok === false);

  const phoneHint = !dupe ? null : dupe.loading ? (
    <span className="hint">Checking the sheet…</span>
  ) : dupe.res?.matches.length ? (
    <span className="hint bad">
      ⚠ {dupe.res.matches.length} prior submission{dupe.res.matches.length > 1 ? "s" : ""} · last {fmtTime(dupe.res.matches[0].timestamp)} ({dupe.res.matches[0].campaign})
    </span>
  ) : (
    <span className="hint ok">✓ New number — no prior submissions</span>
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const missing = (Object.keys(EMPTY) as (keyof Form)[]).find((k) => !f[k].trim());
    if (missing) {
      setMsg({ text: "Please fill in every field.", kind: "bad" });
      form.querySelector<HTMLElement>(`[name="${missing}"]`)?.focus();
      return;
    }
    if (!isValidDob(f.dob)) return setMsg({ text: "Enter a valid date of birth as MM/DD/YYYY.", kind: "bad" });
    if (digits(f.phone).length !== 10 || digits(f.showNumber).length !== 10) return setMsg({ text: "Phone and show number need 10 digits.", kind: "bad" });
    if (f.zipcode.length !== 5) return setMsg({ text: "Zipcode must be 5 digits.", kind: "bad" });
    if (failing.length && !armed) {
      setArmed(true);
      setMsg({ text: `${failing.map((c) => c.detail).join(" · ")}. Press again to submit anyway.`, kind: "warn" });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await api.send<{ timestamp?: string; duplicate?: boolean }>("/api/sheets", "POST", f);
      const stamp = res.timestamp ? `${fmtTime(res.timestamp)} ET` : "just now";
      setMsg({ text: `Lead submitted — ${stamp}${res.duplicate ? " (flagged as duplicate)" : ""}.`, kind: "ok" });
      toast(`Lead submitted — ${f.firstName} ${f.lastName}`, "ok");
      setF({ ...EMPTY, campaign: f.campaign, transferBy: f.transferBy });
      setArmed(false);
      refreshAllSheets();
    } catch (err) {
      setMsg({ text: (err as Error).message, kind: "bad" });
      toast("Submission failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Submit a Lead" sub={<>Submitting as <b>{me?.name ?? "…"}</b> · goes straight to the Leads sheet</>} />

      <div className="lead-layout">
        <form onSubmit={onSubmit} noValidate autoComplete="off" onReset={() => { setF({ ...EMPTY, transferBy: f.transferBy }); setMsg(null); setArmed(false); }}>
          <Card title="Campaign">
            <div className="fields">
              <SelectField label="Campaign" name="campaign" value={f.campaign} onChange={set("campaign")} className="wide">
                <option value="" disabled>Select a campaign…</option>
                {activeCampaigns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </SelectField>
            </div>
          </Card>

          <Card title="Customer" delay={60}>
            <div className="fields">
              <Field label="First name" name="firstName" value={f.firstName} onChange={set("firstName")} />
              <Field label="Last name" name="lastName" value={f.lastName} onChange={set("lastName")} />
              <Field label="Date of birth" name="dob" placeholder="MM/DD/YYYY" inputMode="numeric" value={f.dob} onChange={set("dob")}
                aria-invalid={f.dob.length === 10 && !isValidDob(f.dob)} />
              <Field label="Phone number" name="phone" placeholder="(555) 555-5555" inputMode="tel" value={f.phone} onChange={set("phone")} hint={phoneHint} />
              <Field label="Show number" name="showNumber" placeholder="(555) 555-5555" inputMode="tel" value={f.showNumber} onChange={set("showNumber")} />
            </div>
          </Card>

          <Card title="Address" delay={120}>
            <div className="fields">
              <Field label="Street address" name="street" wide value={f.street} onChange={set("street")} />
              <Field label="City" name="city" value={f.city} onChange={set("city")} />
              <div className="two">
                <Field label="State" name="state" placeholder="TX" value={f.state} onChange={set("state")} />
                <Field label="Zipcode" name="zipcode" inputMode="numeric" value={f.zipcode} onChange={set("zipcode")} />
              </div>
            </div>
          </Card>

          <Card title="Transfer" delay={180}>
            <div className="fields">
              <Field label="Transfer by" name="transferBy" value={f.transferBy} onChange={set("transferBy")} />
              <Field label="Duration" name="duration" placeholder="e.g. 4:12" value={f.duration} onChange={set("duration")} />
            </div>
          </Card>

          <div className="form-actions">
            <button className="btn big" disabled={busy}>
              <Send size={18} /> {busy ? "Submitting…" : armed ? "Submit anyway" : "Submit lead"}
            </button>
            <button className="btn ghost" type="reset">Clear</button>
            {msg && <p className={clsx("form-msg", msg.kind)} role="status">{msg.text}</p>}
          </div>
        </form>

        <Card title="Campaign intel" className="intel" delay={100}>
          {campaign ? (
            <>
              <h4>{campaign.name}</h4>
              <dl className="kv">
                <dt>DID</dt><dd className="mono">{campaign.did}</dd>
                <dt>Timing</dt><dd>{campaign.timing}</dd>
                <dt>Break</dt><dd>{campaign.breakTime}</dd>
                <dt>Age</dt><dd>{campaign.ageLimit}</dd>
                <dt>States</dt><dd>{campaign.states}</dd>
              </dl>
              {campaign.dqNotes && <p className="dq">DQ · {campaign.dqNotes}</p>}
              <ul className="checks">
                {checks.map((c) => {
                  const Icon = c.ok === null ? CircleDashed : c.ok ? CheckCircle2 : CircleAlert;
                  return (
                    <li key={c.label} className={c.ok === null ? "" : c.ok ? "ok" : "bad"}>
                      <Icon size={18} />
                      <div><b>{c.label}</b>{c.detail}</div>
                    </li>
                  );
                })}
              </ul>
              {campaign.formLink && (
                <a className="btn ghost full" href={campaign.formLink} target="_blank" rel="noopener">
                  Before-transfer form <ExternalLink size={15} />
                </a>
              )}
            </>
          ) : (
            <p className="muted">Pick a campaign to see its rules and live state &amp; age checks.</p>
          )}
        </Card>
      </div>
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadForm />
    </Suspense>
  );
}
