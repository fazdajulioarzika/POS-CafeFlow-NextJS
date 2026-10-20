import Link from "next/link";
import {
  Ban,
  CalendarClock,
  Check,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { MENU_MANAGERS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { orderStatusLabel, tableStatusLabel } from "@/lib/labels";
import { TableForm } from "@/components/tables/table-form";
import { ActionButton } from "@/components/layout/action-button";
import { StatusBadge } from "@/components/orders/status-badge";
import { StatusActionButton } from "@/components/orders/status-action-button";
import { RealtimeRefresh } from "@/components/layout/realtime-refresh";
import { toggleTable } from "./actions";

const FILTERS = ["available", "occupied", "reserved", "maintenance"] as const;

// Kosong dibuat paling menonjol; status lain lebih tenang. Selalu ada ikon + teks, bukan warna saja.
const STYLE: Record<string, { icon: LucideIcon; card: string; badge: string }> =
  {
    available: {
      icon: Check,
      card: "border-2 border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20",
      badge: "bg-emerald-700 text-white",
    },
    occupied: {
      icon: Users,
      card: "border border-amber-300 bg-amber-50",
      badge: "bg-amber-200 text-amber-900",
    },
    reserved: {
      icon: CalendarClock,
      card: "border border-blue-300 bg-blue-50",
      badge: "bg-blue-100 text-blue-900",
    },
    maintenance: {
      icon: Wrench,
      card: "border border-dashed bg-muted/60",
      badge: "bg-muted text-foreground",
    },
    inactive: {
      icon: Ban,
      card: "border border-dashed bg-muted/40 opacity-60",
      badge: "bg-muted text-foreground",
    },
  };

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
    on ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
  }`;

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const me = await getCurrentProfile();
  const canManage = MENU_MANAGERS.includes(me.role);
  const filter = FILTERS.find((s) => s === sp.status);

  const supabase = await createClient();
  let tablesQuery = supabase
    .from("dining_tables")
    .select("id, table_number, capacity, status, is_active");
  if (!canManage) tablesQuery = tablesQuery.eq("is_active", true);

  const [{ data: rawTables }, { data: activeOrders }] = await Promise.all([
    tablesQuery,
    supabase
      .from("orders")
      .select("id, order_number, status, table_id")
      .in("status", ["placed", "preparing", "ready", "served"])
      .not("table_id", "is", null),
  ]);

  // urut natural: T1, T2, T10 (bukan T1, T10, T2)
  const tables = [...(rawTables ?? [])].sort((a, b) =>
    a.table_number.localeCompare(b.table_number, "id", { numeric: true })
  );
  const activeTables = tables.filter((t) => t.is_active);

  const counts = { available: 0, occupied: 0, reserved: 0, maintenance: 0 };
  activeTables.forEach((t) => {
    counts[t.status as keyof typeof counts] += 1;
  });
  const freeTables = activeTables.filter((t) => t.status === "available");

  const shown = filter
    ? tables.filter((t) => t.is_active && t.status === filter)
    : tables;
  const orderByTable = new Map(
    (activeOrders ?? []).map((o) => [o.table_id, o])
  );
  const editing = canManage
    ? tables.find((t) => t.id === sp.edit) ?? null
    : null;

  return (
    <div className="space-y-6">
      <RealtimeRefresh tables={["dining_tables", "orders"]} />

      <h1 className="text-2xl font-semibold">Meja</h1>

      {/* banner meja kosong */}
      <div
        role="status"
        className={`rounded-xl border-2 p-4 ${
          freeTables.length
            ? "border-emerald-600 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="text-3xl font-bold">{freeTables.length}</div>
          <div className="font-medium">
            {freeTables.length
              ? "meja kosong sekarang"
              : "Semua meja sedang terisi"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {freeTables.map((t) => (
              <span
                key={t.id}
                className="rounded-md bg-emerald-700 px-2.5 py-1 text-sm font-bold text-white"
              >
                {t.table_number}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* filter status + jumlah */}
      <nav aria-label="Filter status meja" className="flex flex-wrap gap-2">
        <Link
          href="/tables"
          aria-current={!filter ? "page" : undefined}
          className={chip(!filter)}
        >
          Semua ({activeTables.length})
        </Link>
        {FILTERS.map((s) => {
          const Icon = STYLE[s].icon;
          return (
            <Link
              key={s}
              href={`/tables?status=${s}`}
              aria-current={filter === s ? "page" : undefined}
              className={chip(filter === s)}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tableStatusLabel[s]} ({counts[s]})
            </Link>
          );
        })}
      </nav>

      {/* grid meja */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((t) => {
          const S = STYLE[t.is_active ? t.status : "inactive"];
          const Icon = S.icon;
          const label = t.is_active ? tableStatusLabel[t.status] : "Nonaktif";
          const order =
            t.is_active && t.status === "occupied"
              ? orderByTable.get(t.id)
              : undefined;

          return (
            <div
              key={t.id}
              className={`flex flex-col gap-3 rounded-xl p-4 ${S.card}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold">{t.table_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.capacity} kursi
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold uppercase tracking-wide ${S.badge}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </span>
              </div>

              {order && (
                <div className="space-y-2 rounded-lg border bg-card p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium underline"
                    >
                      {order.order_number}
                    </Link>
                    <StatusBadge
                      value={order.status}
                      label={orderStatusLabel[order.status]}
                    />
                  </div>
                  {order.status === "ready" && (
                    <StatusActionButton orderId={order.id} to="served">
                      Tandai sudah diantar
                    </StatusActionButton>
                  )}
                  {order.status === "served" && (
                    <StatusActionButton orderId={order.id} to="completed">
                      pelanggan selesai
                    </StatusActionButton>
                  )}
                </div>
              )}

              {canManage && (
                <div className="flex gap-2">
                  <Link
                    href={`/tables?edit=${t.id}#form-meja`}
                    className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-sm"
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
          );
        })}
        {shown.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            Tidak ada meja pada filter ini.
          </p>
        )}
      </section>

      {canManage && (
        <details
          id="form-meja"
          open={!!editing}
          className="rounded-lg border bg-card p-4"
        >
          <summary className="cursor-pointer text-lg font-medium">
            {editing ? `Edit meja ${editing.table_number}` : "Tambah meja"}
          </summary>
          <div className="pt-4">
            <TableForm key={editing?.id ?? "new"} table={editing} />
          </div>
        </details>
      )}
    </div>
  );
}
