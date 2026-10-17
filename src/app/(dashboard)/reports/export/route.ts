import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { resolveRange } from "@/lib/range";
import {
  movementTypeLabel,
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/labels";

const MAX_ROWS = 50_000;
const BATCH = 1000;

async function fetchAll<T>(
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { data, error } = await build(from, from + BATCH - 1);
    if (error) throw new Error("query failed");
    out.push(...(data ?? []));
    if (!data || data.length < BATCH) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const me = await getCurrentProfile();
  if (!["owner", "manager"].includes(me.role))
    return new NextResponse("Forbidden", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const range = resolveRange({
    range: sp.get("range") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const type = sp.get("type");
  const rawStatus = sp.get("status");
  const status: "paid" | "refunded" | null =
    rawStatus === "paid" || rawStatus === "refunded" ? rawStatus : null;
  const supabase = await createClient();

  let header: string[];
  let rows: (string | number | null)[][];

  try {
    if (type === "transactions") {
      const data = await fetchAll((a, b) => {
        let q = supabase
          .from("orders")
          .select(
            "id, order_number, created_at, order_type, status, payment_status, subtotal, discount_amount, tax_amount, total_amount, cashier:profiles(full_name), table:dining_tables(table_number), payments(method)"
          )
          .gte("created_at", range.fromIso)
          .lt("created_at", range.toIso)
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b);
        if (status) q = q.eq("payment_status", status);
        return q;
      });
      header = [
        "Nomor",
        "Waktu",
        "Kasir",
        "Layanan",
        "Meja",
        "Subtotal",
        "Diskon",
        "Pajak",
        "Total",
        "Status pesanan",
        "Status pembayaran",
        "Metode",
      ];
      rows = data.map((o) => [
        o.order_number,
        formatDateTime(o.created_at),
        one(o.cashier)?.full_name ?? "",
        orderTypeLabel[o.order_type],
        one(o.table)?.table_number ?? "",
        o.subtotal,
        o.discount_amount,
        o.tax_amount,
        o.total_amount,
        orderStatusLabel[o.status],
        paymentStatusLabel[o.payment_status],
        Array.isArray(o.payments) && o.payments[0]
          ? paymentMethodLabel[o.payments[0].method]
          : "",
      ]);
    } else if (type === "products") {
      const { data, error } = await supabase.rpc("report_top_products", {
        p_from: range.fromIso,
        p_to: range.toIso,
        p_limit: 500,
      });
      if (error) throw new Error("query failed");
      header = [
        "Produk",
        "Kategori",
        "Terjual",
        "Pendapatan (sebelum diskon pesanan)",
      ];
      rows = (data ?? []).map((p) => [
        p.product_name,
        p.category_name,
        p.quantity,
        p.revenue,
      ]);
    } else if (type === "stock") {
      const data = await fetchAll((a, b) =>
        supabase
          .from("inventory_movements")
          .select(
            "id, movement_type, quantity_delta, stock_after, reason, created_at, ingredient:ingredients(name, unit), creator:profiles(full_name)"
          )
          .gte("created_at", range.fromIso)
          .lt("created_at", range.toIso)
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b)
      );
      header = [
        "Waktu",
        "Bahan",
        "Satuan",
        "Jenis",
        "Perubahan",
        "Stok sesudah",
        "Alasan",
        "Oleh",
      ];
      rows = data.map((m) => [
        formatDateTime(m.created_at),
        one(m.ingredient)?.name ?? "",
        one(m.ingredient)?.unit ?? "",
        movementTypeLabel[m.movement_type],
        m.quantity_delta,
        m.stock_after,
        m.reason ?? "",
        one(m.creator)?.full_name ?? "",
      ]);
    } else if (type === "shifts") {
      const data = await fetchAll((a, b) =>
        supabase
          .from("shifts")
          .select(
            "id, opening_cash, closing_cash, expected_cash, difference, note, opened_at, closed_at, cashier:profiles(full_name)"
          )
          .gte("opened_at", range.fromIso)
          .lt("opened_at", range.toIso)
          .order("opened_at", { ascending: false })
          .order("id")
          .range(a, b)
      );
      header = [
        "Kasir",
        "Dibuka",
        "Ditutup",
        "Kas awal",
        "Diharapkan",
        "Aktual",
        "Selisih",
        "Catatan",
      ];
      rows = data.map((s) => [
        one(s.cashier)?.full_name ?? "",
        formatDateTime(s.opened_at),
        s.closed_at ? formatDateTime(s.closed_at) : "",
        s.opening_cash,
        s.expected_cash,
        s.closing_cash,
        s.difference,
        s.note ?? "",
      ]);
    } else {
      return new NextResponse("Jenis ekspor tidak dikenal", { status: 400 });
    }
  } catch {
    return new NextResponse("Gagal membuat ekspor", { status: 500 });
  }

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cafeflow-${type}-${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
