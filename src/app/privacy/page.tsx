import PublicShell from "@/components/PublicShell";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Privacy() {
  const cfg = await getConfig();
  return (
    <PublicShell cfg={cfg}>
      <div className="card" style={{ padding: 26, maxWidth: 720, margin: "10px auto", fontSize: 14.5 }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Privacy Policy</h1>
        <p>{cfg.courtName} collects only what is needed to process a court reservation: your name, contact number, optional email address, your chosen schedule, and the payment receipt you upload.</p>
        <h3 style={{ fontSize: 16, margin: "16px 0 6px" }}>How we use it</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>To hold and confirm your booking and contact you about it.</li>
          <li>To verify payment against the uploaded receipt.</li>
          <li>To show initials on the public availability grid so other players can see a slot is taken.</li>
        </ul>
        <h3 style={{ fontSize: 16, margin: "16px 0 6px" }}>Retention and sharing</h3>
        <p>Receipts and booking details are kept for accounting and dispute purposes and are not sold or shared with third parties. Requests to view or delete your data can be sent to {cfg.emailAddress || "the club"}.</p>
        <p className="muted">This policy is provided in line with the Philippine Data Privacy Act of 2012 (RA 10173).</p>
      </div>
    </PublicShell>
  );
}
