import { redirect } from "next/navigation";
import { getSession, type AdminSession } from "./auth";

export async function requireAdminPage(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}

/** Audit log and user management are for the owner only. */
export async function requireOwnerPage(): Promise<AdminSession> {
  const s = await requireAdminPage();
  if (s.role !== "owner") redirect("/admin/analytics");
  return s;
}
