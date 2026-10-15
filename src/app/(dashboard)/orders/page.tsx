import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { formatDateTime, jakartaDayRange } from "@/lib/datetime";
import { one } from "@/lib/relations";
import {
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/labels";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;
const ORDER_STATUSES = [
  "draft",
  "placed",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
] as const;
const PAY_STATUSES = ["unpaid", "paid", "refunded"] as const;

type SP = {
  q?: string;
  status?: string;
  payment?: string;
  date?: string;
  page?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const payment = PAY_STATUSES.find((s) => s === sp.payment);
  const range = sp.date ? jakartaDayRange(sp.date) : null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").replace(/[%_]/g, "").trim();

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, created_at, order_type, status, payment_status, total_amount, cashier:profiles(full_name), table:dining_tables(table_number), payments(method)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("order_number", `%${q}%`);
  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);
  if (range)
    query = query.gte("created_at", range.from).lt("created_at", range.to);

  const { data: orders, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (payment) params.set("payment", payment);
    if (sp.date && range) params.set("date", sp.date);
    params.set("page", String(p));
    return `/orders?${params.toString()}`;
  };

  const selectCls = "h-9 rounded-md border border-input bg-card px-3 text-sm";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pesanan</h1>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Nomor pesanan"
          aria-label="Cari nomor pesanan"
          className="max-w-[200px]"
        />
        <Input
          name="date"
          type="date"
          defaultValue={sp.date}
          aria-label="Tanggal"
          className="w-auto"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Status pesanan"
          className={selectCls}
        >
          <option value="">Semua status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel[s]}
            </option>
          ))}
        </select>
        <select
          name="payment"
          defaultValue={payment ?? ""}
          aria-label="Status pembayaran"
          className={selectCls}
        >
          <option value="">Semua pembayaran</option>
          {PAY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {paymentStatusLabel[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        <Link
          href="/orders"
          className="inline-flex h-9 items-center px-2 text-sm underline"
        >
          Reset
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
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
                  Tidak ada pesanan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>
          Halaman {page} dari {totalPages} · {count ?? 0} pesanan
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
          {page < totalPages && (
            <Link
              href={href(page + 1)}
              className="inline-flex h-8 items-center rounded-md border px-3"
            >
              Berikutnya
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
