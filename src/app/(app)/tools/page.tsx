"use client";

import { ArrowUpRight, Copy, ExternalLink, Headset } from "lucide-react";
import { useToast } from "@/components/Toasts";
import { Card, PageHead } from "@/components/ui";
import { dialer, tools } from "@/lib/config";

export default function ToolsPage() {
  const toast = useToast();

  const copyLogin = () => {
    const text = [
      `Dialer Domain: ${dialer.domain}`,
      `IP Whitelisted Link: ${dialer.ipLink}`,
      `Username: ${dialer.username}`,
      `Password: ${dialer.password}`,
      `Login: ${dialer.note}`,
    ].join("\n");
    navigator.clipboard?.writeText(text);
    toast("Login details copied", "ok");
  };

  return (
    <>
      <PageHead title="Tools" sub="Forms, lookups and the dialer — one click away" />
      <div className="row2">
        <Card title="Links">
          <div className="tool-links">
            {tools.map((t) => (
              <a key={t.name} className="tool-link" href={t.url} target="_blank" rel="noopener">
                <span className="ic"><ExternalLink size={18} /></span>
                <span>
                  <b>{t.name}</b>
                  <small>{t.note}</small>
                </span>
                <ArrowUpRight size={18} className="arrow" />
              </a>
            ))}
          </div>
        </Card>
        <Card title="Dialer" delay={80}>
          <dl className="kv">
            <dt>Domain</dt><dd className="mono">{dialer.domain}</dd>
            <dt>IP link</dt><dd className="mono">{dialer.ipLink}</dd>
            <dt>Login</dt><dd>{dialer.note}</dd>
          </dl>
          <div className="btn-row">
            <a className="btn" href={dialer.domain} target="_blank" rel="noopener"><Headset size={17} /> Open dialer</a>
            <a className="btn ghost" href={dialer.ipLink} target="_blank" rel="noopener">IP whitelisted link <ExternalLink size={15} /></a>
            <button className="btn ghost" onClick={copyLogin}><Copy size={16} /> Copy login details</button>
          </div>
        </Card>
      </div>
    </>
  );
}
