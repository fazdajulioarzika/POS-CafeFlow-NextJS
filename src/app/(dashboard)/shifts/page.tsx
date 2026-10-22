import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { paymentMethodLabel } from "@/lib/labels";
import { qs, rangeParams, rangeText, resolveRange } from "@/lib/range";
import { RangeFilter } from "@/components/layout/range-filter";
import {
  CashMovementForm,
  CloseShiftForm,
  OpenShiftForm,
} from "@/components/shifts/shift-forms";

type Summary = {
  opening: number;
  cash_sales: number;
  cash_in: number;
  cash_out: number;
  cash_refunds: number;
  expected: number;
  by_method: { method: string; count: number; total: number }[];
};

const PAGE_SIZE = 20;
type SP = {
  range?: string;
  from?: string;
  to?: string;
  page?: string;
  cashier?: string;
};

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const me = await getCurrentProfile();
  const isManager = me.role === "owner" || me.role === "manager";
  const range = resolveRange(sp, "7d");
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const cashierFilter =
    isManager && /^[0-9a-f-]{36}$/i.test(sp.cashier ?? "")
      ? sp.cashier
      : undefined;
  const rp = rangeParams(range);
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("shifts")
    .select("id, opened_at, opening_cash")
    .eq("cashier_id", me.id)
    .eq("status", "open")
    .maybeSingle();

  const summaryRes = open
    ? await supabase.rpc("shift_summary", { p_shift_id: open.id })
    : null;
  const summary = (summaryRes?.data ?? null) as unknown as Summary | null;

  const movementsRes = open
    ? await supabase
        .from("cash_movements")
        .select("id, type, amount, reason, created_at")
        .eq("shift_id", open.id)
        .order("created_at", { ascending: false })
    : null;
  const movements = movementsRes?.data ?? [];

  let hq = supabase
    .from("shifts")
    .select(
      "id, status, opening_cash, closing_cash, expected_cash, difference, note, opened_at, closed_at, cashier:profiles(full_name)",
      { count: "exact" }
    )
    .gte("opened_at", range.fromIso)
    .lt("opened_at", range.toIso)
    .order("opened_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (cashierFilter) hq = hq.eq("cashier_id", cashierFilter);
  const { data: history, count } = await hq;

  const staffRes = isManager
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["cashier", "manager", "owner"])
        .order("full_name")
    : null;
  const staff = staffRes?.data ?? [];

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) =>
    `/shifts?${qs({ ...rp, cashier: cashierFilter, page: String(p) })}`;

  const rows: [string, number, boolean?][] = summary
    ? [
        ["Kas awal", summary.opening],
        ["Penjualan tunai diterima", summary.cash_sales],
        ["Kas masuk lain", summary.cash_in],
        ["Kas keluar", -summary.cash_out],
        ["Refund tunai", -summary.cash_refunds],
        ["Kas yang diharapkan", summary.expected, true],
      ]
    : [];

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Shift kasir</h1>

      {open && summary ? (
        <>
          <section className="space-y-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4">
            <div className="font-medium">
              Shift terbuka sejak {formatDateTime(open.opened_at)}
            </div>
            <dl className="grid max-w-md gap-1 text-sm">
              {rows.map(([label, value, strong]) => (
                <div
                  key={label}
                  className={`flex justify-between ${
                    strong ? "border-t pt-2 text-base font-semibold" : ""
                  }`}
                >
                  <dt>{label}</dt>
                  <dd>
                    {value < 0 ? "-" : ""}
                    {formatRupiah(Math.abs(value))}
                  </dd>
                </div>
              ))}
            </dl>
            {summary.by_method.length > 0 && (
              <div className="space-y-1 text-sm">
                <div className="font-medium">
                  Pembayaran diterima per metode
                </div>
                <ul className="space-y-0.5">
                  {summary.by_method.map((m) => (
                    <li
                      key={m.method}
                      className="flex max-w-md justify-between"
                    >
                      <span>
                        {paymentMethodLabel[m.method]} ({m.count} transaksi)
                      </span>
                      <span>{formatRupiah(m.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">
              Kas masuk / keluar non-penjualan
            </h2>
            <CashMovementForm />
            {movements.length > 0 && (
              <div className="max-w-xl overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left">
                    <tr>
                      <th className="p-3">Waktu</th>
                      <th className="p-3">Jenis</th>
                      <th className="p-3">Jumlah</th>
                      <th className="p-3">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-3">{formatDateTime(m.created_at)}</td>
                        <td className="p-3">
                          {m.type === "in" ? "Masuk" : "Keluar"}
                        </td>
                        <td className="p-3">{formatRupiah(m.amount)}</td>
                        <td className="p-3">{m.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Tutup shift</h2>
            <CloseShiftForm expected={summary.expected} />
          </section>
        </>
      ) : null}

      {/* kiri: buka shift (bila belum ada) | kanan: filter riwayat */}
      <div
        className={`grid gap-8 lg:items-start ${!open ? "lg:grid-cols-2" : ""}`}
      >
        {!open && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Buka shift</h2>
            <p className="text-sm text-muted-foreground">
              Pembayaran tunai hanya bisa diterima saat shift terbuka.
            </p>
            <OpenShiftForm />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            {isManager ? "Riwayat semua shift" : "Riwayat shift saya"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Periode: {rangeText(range)}
          </p>

          <RangeFilter
            basePath="/shifts"
            range={range}
            extra={{ cashier: cashierFilter }}
          />

          {isManager && (
            <form
              method="get"
              action="/shifts"
              className="flex flex-wrap items-end gap-2 print:hidden"
            >
              <input type="hidden" name="range" value={range.preset} />
              {range.preset === "custom" && (
                <>
                  <input type="hidden" name="from" value={range.from} />
                  <input type="hidden" name="to" value={range.to} />
                </>
              )}
              <label className="space-y-1 text-sm">
                <span className="block">Kasir</span>
                <select
                  name="cashier"
                  defaultValue={cashierFilter ?? ""}
                  className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">Semua kasir</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-9 rounded-md border bg-card px-4 text-sm"
              >
                Terapkan
              </button>
            </form>
          )}
        </section>
      </div>

      {/* tabel riwayat selebar penuh */}
      <section className="space-y-3">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Kasir</th>
                <th className="p-3">Dibuka</th>
                <th className="p-3">Ditutup</th>
                <th className="p-3">Kas awal</th>
                <th className="p-3">Diharapkan</th>
                <th className="p-3">Aktual</th>
                <th className="p-3">Selisih</th>
                <th className="p-3">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {history?.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{one(s.cashier)?.full_name || "-"}</td>
                  <td className="p-3">{formatDateTime(s.opened_at)}</td>
                  <td className="p-3">
                    {s.closed_at
                      ? formatDateTime(s.closed_at)
                      : "Masih terbuka"}
                  </td>
                  <td className="p-3">{formatRupiah(s.opening_cash)}</td>
                  <td className="p-3">
                    {s.expected_cash === null
                      ? "-"
                      : formatRupiah(s.expected_cash)}
                  </td>
                  <td className="p-3">
                    {s.closing_cash === null
                      ? "-"
                      : formatRupiah(s.closing_cash)}
                  </td>
                  <td className="p-3 font-medium">
                    {s.difference === null
                      ? "-"
                      : s.difference === 0
                      ? "Sesuai"
                      : `${
                          s.difference > 0 ? "Lebih" : "Kurang"
                        } ${formatRupiah(Math.abs(s.difference))}`}
                  </td>
                  <td className="p-3">{s.note ?? "-"}</td>
                </tr>
              ))}
              {!history?.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Tidak ada shift pada periode ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>
            Halaman {page} dari {pages} · {count ?? 0} shift
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex h-8 items-center rounded-md border px-3"
              >
                Sebelumnya
              </Link>
            )}
            {page < pages && (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex h-8 items-center rounded-md border px-3"
              >
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
