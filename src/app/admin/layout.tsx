import Link from "next/link";
import { getSession, touchSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  ["/admin/bookings", "Bookings"],
  ["/admin/grid", "Court grid"],
  ["/admin/equipment", "Equipment"],
  ["/admin/settings", "Settings"],
  ["/admin/audit", "Audit log"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>; // pages redirect to /admin/login themselves
  await touchSession(session);
  return (
    <div className="admin">
      <aside className="admin-side">
        <div style={{ fontWeight: 800, color: "var(--ck-gold)", marginBottom: 2 }}>Chateau Katriannah</div>
        <div className="muted" style={{ color: "rgba(255,255,255,.6)", marginBottom: 16 }}>Admin · {session.email}</div>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <Link href="/" target="_blank">
          View site ↗
        </Link>
        <form action="/api/admin/logout" method="post" style={{ marginTop: 20 }}>
          <button className="btn btn-outline btn-sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>
            Sign out
          </button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
