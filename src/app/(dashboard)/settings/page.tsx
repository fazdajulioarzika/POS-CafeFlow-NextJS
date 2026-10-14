import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pengaturan</h1>
      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p>Pengaturan belum tersedia.</p>
      )}
    </div>
  );
}
