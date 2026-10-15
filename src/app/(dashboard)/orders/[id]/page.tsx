import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { getCurrentProfile } from "@/lib/auth";
import { StatusActionButton } from "@/components/orders/status-action-button";
import {
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/labels";
import { StatusBadge } from "@/components/orders/status-badge";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), payments(*), cashier:profiles(full_name), table:dining_tables(table_number)"
    )
    .eq("id", id)
    .order("position", { referencedTable: "order_items" })
    .maybeSingle();
  if (!order) notFound();
  const me = await getCurrentProfile();
  const canAct = ["owner", "manager", "cashier"].includes(me.role);
  const nextStep: { to: "served" | "completed"; label: string } | null = !canAct
    ? null
    : order.status === "ready"
    ? order.order_type === "dine_in"
      ? { to: "served", label: "Tandai sudah diantar" }
      : { to: "completed", label: "Serahkan ke pelanggan" }
    : order.status === "served"
    ? { to: "completed", label: "Pelanggan selesai" }
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{order.order_number}</h1>
        {nextStep && (
          <StatusActionButton orderId={order.id} to={nextStep.to}>
            {nextStep.label}
          </StatusActionButton>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href={`/receipt/${order.id}`}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Lihat struk
          </Link>
          <Link
            href="/orders"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
        <div>Waktu: {formatDateTime(order.created_at)}</div>
        <div>Kasir: {one(order.cashier)?.full_name || "-"}</div>
        <div>
          Layanan: {orderTypeLabel[order.order_type]}
          {one(order.table)?.table_number &&
            ` · Meja ${one(order.table)?.table_number}`}
        </div>
        <div className="flex gap-2">
          <StatusBadge
            value={order.status}
            label={orderStatusLabel[order.status]}
          />
          <StatusBadge
            value={order.payment_status}
            label={paymentStatusLabel[order.payment_status]}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Harga</th>
              <th className="p-3">Jml</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{it.product_name}</div>
                  {it.variant_name && (
                    <div className="text-xs text-muted-foreground">
                      {it.variant_name}
                    </div>
                  )}
                  {it.notes && (
                    <div className="text-xs italic">Catatan: {it.notes}</div>
                  )}
                </td>
                <td className="p-3">{formatRupiah(it.unit_price)}</td>
                <td className="p-3">{it.quantity}</td>
                <td className="p-3 text-right">
                  {formatRupiah(it.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatRupiah(order.subtotal)}</dd>
        </div>
        {order.discount_amount > 0 && (
          <div className="flex justify-between">
            <dt>Diskon</dt>
            <dd>-{formatRupiah(order.discount_amount)}</dd>
          </div>
        )}
        {order.tax_amount > 0 && (
          <div className="flex justify-between">
            <dt>Pajak ({order.tax_percent}%)</dt>
            <dd>{formatRupiah(order.tax_amount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatRupiah(order.total_amount)}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Pembayaran</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Metode</th>
                <th className="p-3">Nominal</th>
                <th className="p-3">Diterima</th>
                <th className="p-3">Kembalian</th>
                <th className="p-3">Referensi</th>
                <th className="p-3">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{paymentMethodLabel[p.method]}</td>
                  <td className="p-3">{formatRupiah(p.amount)}</td>
                  <td className="p-3">{formatRupiah(p.tendered)}</td>
                  <td className="p-3">{formatRupiah(p.change_amount)}</td>
                  <td className="p-3">{p.reference ?? "-"}</td>
                  <td className="p-3">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
