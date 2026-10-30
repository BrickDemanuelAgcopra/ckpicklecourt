import { requireAdminPage } from "@/lib/admin";
import { getConfig, getCourts, getRateBands } from "@/lib/config";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage();
  const [cfg, courts, bands] = await Promise.all([getConfig(), getCourts(), getRateBands()]);
  return (
    <>
      <h1>Settings</h1>
      <SettingsForm cfg={cfg} courts={courts} bands={bands} />
    </>
  );
}
