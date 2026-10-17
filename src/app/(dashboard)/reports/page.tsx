import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { formatQty } from "@/lib/units";
import {
  movementTypeLabel,
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/labels";
import {
  formatDay,
  qs,
  rangeParams,
  rangeText,
  resolveRange,
  type DateRange,
} from "@/lib/range";
import { StatusBadge } from "@/components/orders/status-badge";
import { RangeFilter } from "@/components/layout/range-filter";
import { PrintPageButton } from "@/components/layout/print-page-button";

type Db = Awaited<ReturnType<typeof createClient>>;

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "transaksi", label: "Transaksi" },
  { key: "refund", label: "Refund" },
  { key: "stok", label: "Stok" },
  { key: "kas", label: "Selisih kas" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 25;
type SP = {
  tab?: string;
  range?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: string;
};

const chip = (on: boolean) =>
  `inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${
    on ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
  }`;
const box = "overflow-x-auto rounded-xl border bg-card";
const head = "bg-secondary text-left";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const tab: TabKey = TABS.find((t) => t.key === sp.tab)?.key ?? "ringkasan";
  const range = resolveRange(sp);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const status =
    sp.status === "paid" || sp.status === "refunded" ? sp.status : undefined;
  const rp = rangeParams(range);
  const db = await createClient();

  const exportHref = (type: string) =>
    `/reports/export?${qs({ type, ...rp, status })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Laporan</h1>
          <p className="text-sm text-muted-foreground">
            Periode: {rangeText(range)}
          </p>
        </div>
        <div className="print:hidden">
          <PrintPageButton />
        </div>
      </div>

      <RangeFilter basePath="/reports" range={range} extra={{ tab, status }} />

      <nav
        aria-label="Jenis laporan"
        className="flex flex-wrap gap-2 print:hidden"
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reports?${qs({ tab: t.key, ...rp })}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={chip(tab === t.key)}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "ringkasan" && (
        <SummaryTab db={db} range={range} exportHref={exportHref("products")} />
      )}
      {tab === "transaksi" && (
        <TransactionsTab
          db={db}
          range={range}
          page={page}
          status={status}
          exportHref={exportHref("transactions")}
          pageHref={(p) =>
            `/reports?${qs({ tab, ...rp, status, page: String(p) })}`
          }
          statusHref={(s) => `/reports?${qs({ tab, ...rp, status: s })}`}
        />
      )}
      {tab === "refund" && <RefundsTab db={db} range={range} />}
      {tab === "stok" && (
        <StockTab
          db={db}
          range={range}
          page={page}
          exportHref={exportHref("stock")}
          pageHref={(p) => `/reports?${qs({ tab, ...rp, page: String(p) })}`}
        />
      )}
      {tab === "kas" && (
        <CashTab db={db} range={range} exportHref={exportHref("shifts")} />
      )}
    </div>
  );
}

function Pager({
  page,
  total,
  href,
}: {
  page: number;
  total: number;
  href: (p: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between text-sm print:hidden">
      <span>
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={href(page - 1)}
            className="inline-flex h-8 items-center rounded-md border px-3"
          >
            Sebelumnya
          </Link>
        )}
        {page < pages && (
          <Link
            href={href(page + 1)}
            className="inline-flex h-8 items-center rounded-md border px-3"
          >
            Berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}

function CsvLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-sm print:hidden"
    >
      Ekspor CSV
    </a>
  );
}

async function SummaryTab({
  db,
  range,
  exportHref,
}: {
  db: Db;
  range: DateRange;
  exportHref: string;
}) {
  const args = { p_from: range.fromIso, p_to: range.toIso };
  const [sum, daily, top, methods] = await Promise.all([
    db.rpc("report_summary", args),
    db.rpc("report_daily", args),
    db.rpc("report_top_products", { ...args, p_limit: 20 }),
    db.rpc("report_payment_methods", args),
  ]);
  const s = sum.data?.[0];
  const cards: [string, string][] = [
    ["Penjualan bersih", formatRupiah(s?.net_sales ?? 0)],
    ["Transaksi", String(s?.transactions ?? 0)],
    ["Rata-rata transaksi", formatRupiah(s?.avg_value ?? 0)],
    ["Diskon diberikan", formatRupiah(s?.discount_total ?? 0)],
    ["Pajak", formatRupiah(s?.tax_total ?? 0)],
    [
      "Refund",
      `${s?.refund_count ?? 0} · ${formatRupiah(s?.refund_total ?? 0)}`,
    ],
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Per hari</h2>
        <div className={box}>
          <table className="w-full text-sm">
            <thead className={head}>
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Transaksi</th>
                <th className="p-3 text-right">Penjualan bersih</th>
              </tr>
            </thead>
            <tbody>
              {daily.data?.map((d) => (
                <tr key={d.day} className="border-t">
                  <td className="p-3">{formatDay(d.day)}</td>
                  <td className="p-3">{d.transactions}</td>
                  <td className="p-3 text-right">
                    {formatRupiah(d.net_sales)}
                  </td>
                </tr>
              ))}
              {!daily.data?.length && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Tidak ada penjualan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Produk terjual (20 teratas)</h2>
          <CsvLink href={exportHref} />
        </div>
        <div className={box}>
          <table className="w-full text-sm">
            <thead className={head}>
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Terjual</th>
                <th className="p-3 text-right">Pendapatan*</th>
              </tr>
            </thead>
            <tbody>
              {top.data?.map((p) => (
                <tr key={p.product_id} className="border-t">
                  <td className="p-3 font-medium">{p.product_name}</td>
                  <td className="p-3">{p.category_name}</td>
                  <td className="p-3">{p.quantity}</td>
                  <td className="p-3 text-right">{formatRupiah(p.revenue)}</td>
                </tr>
              ))}
              {!top.data?.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          *Sebelum diskon pesanan. Kategori mengikuti kategori produk saat ini.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Metode pembayaran</h2>
        <div className={box}>
          <table className="w-full text-sm">
            <thead className={head}>
              <tr>
                <th className="p-3">Metode</th>
                <th className="p-3">Transaksi</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {methods.data?.map((m) => (
                <tr key={m.method} className="border-t">
                  <td className="p-3">{paymentMethodLabel[m.method]}</td>
                  <td className="p-3">{m.transactions}</td>
                  <td className="p-3 text-right">{formatRupiah(m.total)}</td>
                </tr>
              ))}
              {!methods.data?.length && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Penjualan bersih = total pesanan berstatus Lunas pada tanggal pesanan
        (zona Asia/Jakarta). Pesanan yang direfund tidak dihitung dan dilaporkan
        terpisah. Angka sama dengan Dashboard.
      </p>
    </div>
  );
}

async function TransactionsTab({
  db,
  range,
  page,
  status,
  exportHref,
  pageHref,
  statusHref,
}: {
  db: Db;
  range: DateRange;
  page: number;
  status?: "paid" | "refunded";
  exportHref: string;
  pageHref: (p: number) => string;
  statusHref: (s?: string) => string;
}) {
  let q = db
    .from("orders")
    .select(
      "id, order_number, created_at, order_type, status, payment_status, total_amount, cashier:profiles(full_name), table:dining_tables(table_number), payments(method)",
      { count: "exact" }
    )
    .gte("created_at", range.fromIso)
    .lt("created_at", range.toIso)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) q = q.eq("payment_status", status);
  const { data: orders, count } = await q;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-2">
          <Link href={statusHref()} className={chip(!status)}>
            Semua
          </Link>
          <Link href={statusHref("paid")} className={chip(status === "paid")}>
            Lunas
          </Link>
          <Link
            href={statusHref("refunded")}
            className={chip(status === "refunded")}
          >
            Refund
          </Link>
        </div>
        <CsvLink href={exportHref} />
      </div>
      <div className={box}>
        <table className="w-full text-sm">
          <thead className={head}>
            <tr>
              <th className="p-3">Nomor</th>
              <th className="p-3">Waktu</th>
              <th className="p-3">Kasir</th>
              <th className="p-3">Layanan</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Pembayaran</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => {
              const method = Array.isArray(o.payments)
                ? o.payments[0]?.method
                : null;
              return (
                <tr key={o.id} className="border-t">
                  <td className="p-3">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-medium underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="p-3">{formatDateTime(o.created_at)}</td>
                  <td className="p-3">{one(o.cashier)?.full_name || "-"}</td>
                  <td className="p-3">
                    {orderTypeLabel[o.order_type]}
                    {one(o.table)?.table_number &&
                      ` · ${one(o.table)?.table_number}`}
                  </td>
                  <td className="p-3">{formatRupiah(o.total_amount)}</td>
                  <td className="p-3">
                    <StatusBadge
                      value={o.status}
                      label={orderStatusLabel[o.status]}
                    />
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      value={o.payment_status}
                      label={paymentStatusLabel[o.payment_status]}
                    />
                    {method && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {paymentMethodLabel[method]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!orders?.length && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-muted-foreground"
                >
                  Tidak ada transaksi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={count ?? 0} href={pageHref} />
    </div>
  );
}

async function RefundsTab({ db, range }: { db: Db; range: DateRange }) {
  const { data } = await db
    .from("orders")
    .select(
      "id, order_number, created_at, total_amount, refund:refunds(reason, amount, created_at, method, refunder:profiles(full_name))"
    )
    .eq("payment_status", "refunded")
    .gte("created_at", range.fromIso)
    .lt("created_at", range.toIso)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-3">
      <div className={box}>
        <table className="w-full text-sm">
          <thead className={head}>
            <tr>
              <th className="p-3">Pesanan</th>
              <th className="p-3">Waktu pesanan</th>
              <th className="p-3">Refund</th>
              <th className="p-3">Metode</th>
              <th className="p-3">Alasan</th>
              <th className="p-3">Oleh</th>
              <th className="p-3">Waktu refund</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((o) => {
              const r = one(o.refund);
              return (
                <tr key={o.id} className="border-t">
                  <td className="p-3">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-medium underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="p-3">{formatDateTime(o.created_at)}</td>
                  <td className="p-3">
                    {formatRupiah(r?.amount ?? o.total_amount)}
                  </td>
                  <td className="p-3">
                    {r ? paymentMethodLabel[r.method] : "-"}
                  </td>
                  <td className="p-3">{r?.reason ?? "-"}</td>
                  <td className="p-3">{one(r?.refunder)?.full_name || "-"}</td>
                  <td className="p-3">
                    {r ? formatDateTime(r.created_at) : "-"}
                  </td>
                </tr>
              );
            })}
            {!data?.length && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-muted-foreground"
                >
                  Tidak ada refund
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Menampilkan refund atas pesanan yang dibuat pada periode ini. Stok tidak
        dikembalikan otomatis.
      </p>
    </div>
  );
}

async function StockTab({
  db,
  range,
  page,
  exportHref,
  pageHref,
}: {
  db: Db;
  range: DateRange;
  page: number;
  exportHref: string;
  pageHref: (p: number) => string;
}) {
  const [usage, moves] = await Promise.all([
    db.rpc("report_ingredient_usage", {
      p_from: range.fromIso,
      p_to: range.toIso,
    }),
    db
      .from("inventory_movements")
      .select(
        "id, movement_type, quantity_delta, stock_after, reason, created_at, ingredient:ingredients(name, unit), creator:profiles(full_name)",
        { count: "exact" }
      )
      .gte("created_at", range.fromIso)
      .lt("created_at", range.toIso)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">
          Pemakaian bahan (dari penjualan)
        </h2>
        <div className={box}>
          <table className="w-full text-sm">
            <thead className={head}>
              <tr>
                <th className="p-3">Bahan</th>
                <th className="p-3 text-right">Terpakai</th>
              </tr>
            </thead>
            <tbody>
              {usage.data?.map((u) => (
                <tr key={u.ingredient_id} className="border-t">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-right">
                    {formatQty(u.used, u.unit)}
                  </td>
                </tr>
              ))}
              {!usage.data?.length && (
                <tr>
                  <td
                    colSpan={2}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Tidak ada pemakaian
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Mutasi stok</h2>
          <CsvLink href={exportHref} />
        </div>
        <div className={box}>
          <table className="w-full text-sm">
            <thead className={head}>
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Bahan</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Perubahan</th>
                <th className="p-3">Sesudah</th>
                <th className="p-3">Alasan</th>
                <th className="p-3">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {moves.data?.map((m) => {
                const ing = one(m.ingredient);
                const unit = ing?.unit ?? "";
                return (
                  <tr key={m.id} className="border-t">
                    <td className="p-3">{formatDateTime(m.created_at)}</td>
                    <td className="p-3">{ing?.name ?? "-"}</td>
                    <td className="p-3">
                      {movementTypeLabel[m.movement_type]}
                    </td>
                    <td className="p-3 font-medium">
                      {m.quantity_delta > 0 ? "+" : ""}
                      {formatQty(m.quantity_delta, unit)}
                    </td>
                    <td className="p-3">{formatQty(m.stock_after, unit)}</td>
                    <td className="p-3">{m.reason ?? "-"}</td>
                    <td className="p-3">{one(m.creator)?.full_name || "-"}</td>
                  </tr>
                );
              })}
              {!moves.data?.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Tidak ada mutasi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={moves.count ?? 0} href={pageHref} />
      </section>
    </div>
  );
}

async function CashTab({
  db,
  range,
  exportHref,
}: {
  db: Db;
  range: DateRange;
  exportHref: string;
}) {
  const { data } = await db
    .from("shifts")
    .select(
      "id, status, opening_cash, closing_cash, expected_cash, difference, note, opened_at, closed_at, cashier:profiles(full_name)"
    )
    .gte("opened_at", range.fromIso)
    .lt("opened_at", range.toIso)
    .order("opened_at", { ascending: false })
    .limit(200);

  const diffSum = (data ?? []).reduce((a, s) => a + (s.difference ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Total selisih kas periode ini:{" "}
          <strong>
            {diffSum === 0
              ? "nol"
              : `${diffSum > 0 ? "lebih" : "kurang"} ${formatRupiah(
                  Math.abs(diffSum)
                )}`}
          </strong>
        </p>
        <CsvLink href={exportHref} />
      </div>
      <div className={box}>
        <table className="w-full text-sm">
          <thead className={head}>
            <tr>
              <th className="p-3">Kasir</th>
              <th className="p-3">Dibuka</th>
              <th className="p-3">Ditutup</th>
              <th className="p-3">Diharapkan</th>
              <th className="p-3">Aktual</th>
              <th className="p-3">Selisih</th>
              <th className="p-3">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{one(s.cashier)?.full_name || "-"}</td>
                <td className="p-3">{formatDateTime(s.opened_at)}</td>
                <td className="p-3">
                  {s.closed_at ? formatDateTime(s.closed_at) : "Masih terbuka"}
                </td>
                <td className="p-3">
                  {s.expected_cash === null
                    ? "-"
                    : formatRupiah(s.expected_cash)}
                </td>
                <td className="p-3">
                  {s.closing_cash === null ? "-" : formatRupiah(s.closing_cash)}
                </td>
                <td className="p-3 font-medium">
                  {s.difference === null
                    ? "-"
                    : s.difference === 0
                    ? "Sesuai"
                    : `${s.difference > 0 ? "Lebih" : "Kurang"} ${formatRupiah(
                        Math.abs(s.difference)
                      )}`}
                </td>
                <td className="p-3">{s.note ?? "-"}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-muted-foreground"
                >
                  Tidak ada shift
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
