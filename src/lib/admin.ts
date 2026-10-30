import { redirect } from "next/navigation";
import { getSession, type AdminSession } from "./auth";

export async function requireAdminPage(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}
