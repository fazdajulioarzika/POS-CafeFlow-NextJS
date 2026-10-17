import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { formatQty } from "@/lib/units";
import { paymentMethodLabel } from "@/lib/labels";
import { addDays, formatDay, rangeText, resolveRange } from "@/lib/range";
import { RangeFilter } from "@/components/layout/range-filter";
import { StockBadge, stockState } from "@/components/inventory/stock-badge";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = resolveRange(await searchParams);
  const supabase = await createClient();
  const args = { p_from: range.fromIso, p_to: range.toIso };

  const [
    summary,
    daily,
    top,
    methods,
    active,
    ingredients,
    openShifts,
    closedShifts,
  ] = await Promise.all([
    supabase.rpc("report_summary", args),
    supabase.rpc("report_daily", args),
    supabase.rpc("report_top_products", { ...args, p_limit: 5 }),
    supabase.rpc("report_payment_methods", args),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["placed", "preparing", "ready", "served"]),
    supabase
      .from("ingredients")
      .select("id, name, unit, stock_quantity, minimum_stock")
      .eq("is_active", true),
    supabase
      .from("shifts")
      .select("id, opened_at, opening_cash, cashier:profiles(full_name)")
      .eq("status", "open"),
    supabase
      .from("shifts")
      .select("difference")
      .eq("status", "closed")
      .gte("closed_at", range.fromIso)
      .lt("closed_at", range.toIso),
  ]);

  const s = summary.data?.[0];
  const cards: [string, string][] = [
    ["Penjualan bersih", formatRupiah(s?.net_sales ?? 0)],
    ["Transaksi", String(s?.transactions ?? 0)],
    ["Rata-rata transaksi", formatRupiah(s?.avg_value ?? 0)],
    ["Pesanan aktif sekarang", String(active.count ?? 0)],
    [
      "Refund",
      `${s?.refund_count ?? 0} · ${formatRupiah(s?.refund_total ?? 0)}`,
    ],
  ];

  // grafik harian: hari tanpa penjualan tetap tampil bila rentang <= 62 hari
  const byDay = new Map((daily.data ?? []).map((d) => [d.day, d]));
  const dayRows: { day: string; sales: number; tx: number }[] = [];
  const span = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
  if (span <= 62) {
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
      const r = byDay.get(d);
      dayRows.push({
        day: d,
        sales: r?.net_sales ?? 0,
        tx: r?.transactions ?? 0,
      });
    }
  } else {
    (daily.data ?? []).forEach((r) =>
      dayRows.push({ day: r.day, sales: r.net_sales, tx: r.transactions })
    );
  }
  const maxSales = Math.max(0, ...dayRows.map((r) => r.sales));

  const methodTotal = (methods.data ?? []).reduce((a, m) => a + m.total, 0);
  const lowStock = (ingredients.data ?? [])
    .filter((i) => stockState(i.stock_quantity, i.minimum_stock).level !== "ok")
    .slice(0, 6);
  const diffSum = (closedShifts.data ?? []).reduce(
    (a, x) => a + (x.difference ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Periode: {rangeText(range)}
        </p>
      </div>

      <RangeFilter basePath="/dashboard" range={range} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Penjualan harian</h2>
        <ul className="space-y-1.5 rounded-xl border bg-card p-4 text-sm">
          {dayRows.map((r) => (
            <li
              key={r.day}
              className="grid grid-cols-[7rem_1fr_9rem] items-center gap-3"
            >
              <span>{formatDay(r.day)}</span>
              <div className="h-3 rounded bg-secondary" aria-hidden>
                <div
                  className="h-3 rounded bg-primary"
                  style={{
                    width: `${
                      r.sales ? Math.max(2, (r.sales / maxSales) * 100) : 0
                    }%`,
                  }}
                />
              </div>
              <span className="text-right">
                {formatRupiah(r.sales)} · {r.tx} trx
              </span>
            </li>
          ))}
          {!dayRows.length && (
            <li className="text-muted-foreground">Belum ada data</li>
          )}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Produk terlaris</h2>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Produk</th>
                  <th className="p-3">Terjual</th>
                  <th className="p-3 text-right">Pendapatan</th>
                </tr>
              </thead>
              <tbody>
                {top.data?.map((p) => (
                  <tr key={p.product_id} className="border-t">
                    <td className="p-3 font-medium">{p.product_name}</td>
                    <td className="p-3">{p.quantity}</td>
                    <td className="p-3 text-right">
                      {formatRupiah(p.revenue)}
                    </td>
                  </tr>
                ))}
                {!top.data?.length && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-4 text-center text-muted-foreground"
                    >
                      Belum ada penjualan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Metode pembayaran</h2>
          <ul className="space-y-2 rounded-xl border bg-card p-4 text-sm">
            {methods.data?.map((m) => (
              <li key={m.method} className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {paymentMethodLabel[m.method]} · {m.transactions} trx
                  </span>
                  <span>
                    {formatRupiah(m.total)} (
                    {methodTotal
                      ? Math.round((m.total / methodTotal) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="h-2 rounded bg-secondary" aria-hidden>
                  <div
                    className="h-2 rounded bg-primary"
                    style={{
                      width: `${
                        methodTotal ? (m.total / methodTotal) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </li>
            ))}
            {!methods.data?.length && (
              <li className="text-muted-foreground">Belum ada pembayaran</li>
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Stok rendah</h2>
            <Link href="/inventory?low=1" className="text-sm underline">
              Lihat semua
            </Link>
          </div>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {lowStock.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 p-3"
              >
                <Link
                  href={`/inventory/${i.id}`}
                  className="font-medium underline"
                >
                  {i.name}
                </Link>
                <span className="flex items-center gap-2">
                  {formatQty(i.stock_quantity, i.unit)}
                  <StockBadge stock={i.stock_quantity} min={i.minimum_stock} />
                </span>
              </li>
            ))}
            {!lowStock.length && (
              <li className="p-4 text-muted-foreground">Semua stok aman</li>
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Ringkasan shift</h2>
            <Link href="/shifts" className="text-sm underline">
              Detail
            </Link>
          </div>
          <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
            <div>
              <div className="font-medium">
                Shift terbuka ({openShifts.data?.length ?? 0})
              </div>
              <ul className="text-muted-foreground">
                {openShifts.data?.map((sh) => (
                  <li key={sh.id}>
                    {one(sh.cashier)?.full_name || "-"} sejak{" "}
                    {formatDateTime(sh.opened_at)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t pt-2">
              Ditutup pada periode ini:{" "}
              <strong>{closedShifts.data?.length ?? 0}</strong> shift, total
              selisih{" "}
              <strong>
                {diffSum === 0
                  ? "nol"
                  : `${diffSum > 0 ? "lebih" : "kurang"} ${formatRupiah(
                      Math.abs(diffSum)
                    )}`}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Penjualan bersih = total pesanan berstatus Lunas pada tanggal pesanan.
        Pesanan yang direfund tidak dihitung.
      </p>
    </div>
  );
}
