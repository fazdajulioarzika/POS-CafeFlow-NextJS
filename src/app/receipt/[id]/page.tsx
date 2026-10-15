import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { orderTypeLabel, paymentMethodLabel } from "@/lib/labels";
import { PrintButton } from "@/components/orders/print-button";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getCurrentProfile(); // wajib login; RLS membatasi pesanan yang boleh dilihat
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, order_items(*), payments(*), cashier:profiles(full_name), table:dining_tables(table_number)"
      )
      .eq("id", id)
      .order("position", { referencedTable: "order_items" })
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("cafe_name, address, phone, receipt_footer")
      .single(),
  ]);
  if (!order) notFound();

  const pay = order.payments.find((p) => p.status === "paid");
  const tableNo = one(order.table)?.table_number;

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto mb-4 flex max-w-[340px] flex-wrap gap-2 print:hidden">
        <PrintButton />
        <Link
          href="/pos"
          className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm"
        >
          Pesanan baru
        </Link>
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm"
        >
          Detail
        </Link>
      </div>

      <article className="mx-auto max-w-[340px] space-y-3 bg-white p-4 font-mono text-xs text-black">
        <header className="space-y-0.5 text-center">
          <div className="text-base font-bold">
            {settings?.cafe_name ?? "CafeFlow"}
          </div>
          {settings?.address && <div>{settings.address}</div>}
          {settings?.phone && <div>{settings.phone}</div>}
        </header>

        <div className="space-y-0.5 border-y border-dashed py-2">
          <div>No: {order.order_number}</div>
          <div>Waktu: {formatDateTime(order.created_at)}</div>
          <div>Kasir: {one(order.cashier)?.full_name || "-"}</div>
          <div>
            Layanan: {orderTypeLabel[order.order_type]}
            {tableNo && ` · Meja ${tableNo}`}
          </div>
        </div>

        <div className="space-y-2">
          {order.order_items.map((it) => (
            <div key={it.id}>
              <div>
                {it.product_name}
                {it.variant_name ? ` (${it.variant_name})` : ""}
              </div>
              <div className="flex justify-between">
                <span>
                  {it.quantity} x {formatRupiah(it.unit_price)}
                </span>
                <span>{formatRupiah(it.line_total)}</span>
              </div>
              {it.notes && <div className="italic">Catatan: {it.notes}</div>}
            </div>
          ))}
        </div>

        <div className="space-y-0.5 border-t border-dashed pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatRupiah(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>-{formatRupiah(order.discount_amount)}</span>
            </div>
          )}
          {order.tax_amount > 0 && (
            <div className="flex justify-between">
              <span>Pajak ({order.tax_percent}%)</span>
              <span>{formatRupiah(order.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatRupiah(order.total_amount)}</span>
          </div>
        </div>

        {pay && (
          <div className="space-y-0.5 border-t border-dashed pt-2">
            <div className="flex justify-between">
              <span>Metode</span>
              <span>{paymentMethodLabel[pay.method]}</span>
            </div>
            {pay.method === "cash" && (
              <>
                <div className="flex justify-between">
                  <span>Uang diterima</span>
                  <span>{formatRupiah(pay.tendered)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembalian</span>
                  <span>{formatRupiah(pay.change_amount)}</span>
                </div>
              </>
            )}
            {pay.reference && <div>Ref: {pay.reference}</div>}
          </div>
        )}

        {settings?.receipt_footer && (
          <footer className="pt-2 text-center">
            {settings.receipt_footer}
          </footer>
        )}
      </article>
    </main>
  );
}
