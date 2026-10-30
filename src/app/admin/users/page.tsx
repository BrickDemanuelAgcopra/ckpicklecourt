import { requireOwnerPage } from "@/lib/admin";
import { listAdminUsers } from "@/lib/users";
import UsersAdmin from "@/components/admin/UsersAdmin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const s = await requireOwnerPage();
  const users = await listAdminUsers();
  return (
    <>
      <h1>Users</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        Admins can do everything in this panel except open the audit log and manage users. Everything they do is still recorded in the audit log under their email.
      </p>
      <UsersAdmin users={users} me={s.email} />
    </>
  );
}
