"use client";

import { ExternalLink, Lock, PhoneCall } from "lucide-react";
import Link from "next/link";
import { Card, PageHead } from "@/components/ui";
import { useMe } from "@/lib/api";
import { ADMIN_PORTAL } from "@/lib/config";

/* Google blocks framing the editor; the /preview view of a shared sheet can be embedded. */
function embedUrl(url: string) {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/preview${gid ? `#gid=${gid}` : ""}`;
}

export default function CallbacksPage() {
  const { data: me, isLoading } = useMe();
  const url = me?.callbackUrl ?? "";
  const embed = url ? embedUrl(url) : null;

  if (isLoading) return <PageHead title="Callbacks" sub="Loading…" />;

  if (!url)
    return (
      <>
        <PageHead title="Callbacks" />
        <Card className="locked">
          <span className="big-icon"><Lock size={28} /></span>
          <h3>No callback sheet yet</h3>
          <p className="muted">
            {me?.role === "admin" ? (
              <>Add a default callback sheet link or give agents their own in the <Link href={ADMIN_PORTAL}>Admin Portal</Link>.</>
            ) : (
              "Your admin hasn't shared a callback sheet with you. Ask them for access."
            )}
          </p>
        </Card>
      </>
    );

  return (
    <>
      <PageHead title="Callbacks" sub={me?.role === "admin" ? "Default callback sheet (agents see their own link)" : "Call these customers back — shared by your admin"}>
        <a className="btn" href={url} target="_blank" rel="noopener">
          <PhoneCall size={17} /> Open in Google Sheets <ExternalLink size={15} />
        </a>
      </PageHead>
      {embed ? (
        <Card className="sheet-frame">
          <iframe src={embed} title="Callback sheet" loading="lazy" />
        </Card>
      ) : (
        <Card>
          <p className="muted">This link can&apos;t be previewed here. Use &ldquo;Open in Google Sheets&rdquo; above.</p>
        </Card>
      )}
    </>
  );
}
