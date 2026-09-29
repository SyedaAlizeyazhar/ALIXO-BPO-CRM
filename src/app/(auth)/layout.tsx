import { CheckCircle2 } from "lucide-react";
import { Logo, Mark } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="fx" aria-hidden="true"><i /><i /><i /></div>
      <section className="auth-brand">
        <div className="auth-brand-mark">
          <Mark size={92} />
        </div>
        <h1>
          ALIXO <span>BPO</span>
        </h1>
        <p className="auth-tag">Let&apos;s grow together</p>
        <ul>
          <li><CheckCircle2 size={18} /> Submit leads straight to the sheet</li>
          <li><CheckCircle2 size={18} /> Dupe check before every transfer</li>
          <li><CheckCircle2 size={18} /> Live campaigns, callbacks &amp; progress</li>
        </ul>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <div className="auth-logo-sm"><Logo /></div>
          {children}
        </div>
      </section>
    </div>
  );
}
