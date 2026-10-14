import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { MENU_MANAGERS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TableForm, statusLabel } from "@/components/tables/table-form";
import { ActionButton } from "@/components/layout/action-button";
import { toggleTable } from "./actions";

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const me = await getCurrentProfile();
  const canManage = MENU_MANAGERS.includes(me.role);

  const supabase = await createClient();
  let query = supabase
    .from("dining_tables")
    .select("id, table_number, capacity, status, is_active")
    .order("table_number");
  if (!canManage) query = query.eq("is_active", true);
  const { data: tables } = await query;

  const editing = canManage ? tables?.find((t) => t.id === edit) ?? null : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Meja</h1>

      {canManage && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            {editing ? `Edit meja ${editing.table_number}` : "Tambah meja"}
          </h2>
          <TableForm key={editing?.id ?? "new"} table={editing} />
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tables?.map((t) => (
          <div key={t.id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{t.table_number}</span>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {statusLabel[t.status]}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {t.capacity} kursi{!t.is_active && " · Nonaktif"}
            </div>
            {canManage && (
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/tables?edit=${t.id}`}
                  className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
                >
                  Edit
                </Link>
                <ActionButton
                  action={toggleTable.bind(null, t.id, !t.is_active)}
                >
                  {t.is_active ? "Nonaktifkan" : "Aktifkan"}
                </ActionButton>
              </div>
            )}
          </div>
        ))}
        {!tables?.length && (
          <p className="text-sm text-muted-foreground">Belum ada meja</p>
        )}
      </section>
    </div>
  );
}
