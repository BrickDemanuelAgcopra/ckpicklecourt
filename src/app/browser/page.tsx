import PublicShell from "@/components/PublicShell";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Shown when the site is opened inside the Facebook / Messenger in-app browser. */
export default async function BrowserHelp() {
  const cfg = await getConfig();
  return (
    <PublicShell cfg={cfg}>
      <div className="card" style={{ padding: 24, maxWidth: 520, margin: "20px auto" }}>
        <h1 style={{ fontSize: 20 }}>Open in Browser</h1>
        <p style={{ margin: "8px 0 14px" }}>Messenger and Facebook&apos;s built-in browser blocks some booking features. Open this page in your phone&apos;s default browser for a smoother booking experience (e.g. Safari, Chrome, Edge).</p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Tap the ••• button at the top-right corner of the screen.</li>
          <li>Choose “Open in external browser”.</li>
        </ol>
        <p className="muted">Or copy this link: {process.env.SITE_URL || "https://ckpicklecourt.com"}</p>
      </div>
    </PublicShell>
  );
}
