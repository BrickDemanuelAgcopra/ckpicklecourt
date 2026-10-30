import { requireAdminPage } from "@/lib/admin";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const s = await requireAdminPage();
  return (
    <>
      <h1>My account</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Signed in as <b>{s.email}</b> · {s.role === "owner" ? "Owner" : "Admin"}
      </p>
      {s.role === "owner" ? (
        <div className="note" style={{ maxWidth: 560 }}>
          The owner password comes from <span className="mono">ADMIN_PASSWORD</span> in the server&apos;s .env file and is re-applied every time the app restarts. Change it
          there, then restart the app.
        </div>
      ) : (
        <ChangePasswordForm />
      )}
    </>
  );
}
