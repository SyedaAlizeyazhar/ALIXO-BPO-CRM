"use client";

import { Clock, Eye, EyeOff, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui";

export default function SignupPage() {
  const [f, setF] = useState({ name: "", username: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: k === "username" ? e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.password.length < 8) return setError("Password must be at least 8 characters.");
    if (f.password !== f.confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, username: f.username, password: f.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sign-up failed");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="auth-fields center">
        <span className="big-icon"><Clock size={30} /></span>
        <h2>Request sent</h2>
        <p className="muted">
          Thanks, {f.name.split(" ")[0]}. Your account <b>@{f.username}</b> is waiting for admin approval. You can log in as soon as it&apos;s approved.
        </p>
        <Link className="btn full" href="/login">Back to log in</Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="auth-fields">
      <h2>Create your account</h2>
      <p className="muted">Your admin approves new agents before the first login.</p>
      <Field label="Full name" value={f.name} onChange={set("name")} autoComplete="name" autoFocus required />
      <Field label="Username" value={f.username} onChange={set("username")} autoComplete="username" required
        hint={<span className="hint">Letters, numbers, dot, dash or underscore</span>} />
      <label className="inp">
        Password
        <span className="pw">
          <input type={show ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete="new-password" required minLength={8} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </label>
      <Field label="Confirm password" type={show ? "text" : "password"} value={f.confirm} onChange={set("confirm")} autoComplete="new-password" required />
      {error && <p className="form-msg bad">{error}</p>}
      <button className="btn full" disabled={busy}>
        <UserPlus size={18} /> {busy ? "Sending…" : "Request access"}
      </button>
      <p className="auth-switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
