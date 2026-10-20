import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTotals } from "@/lib/pricing";
import {
  admin,
  checkout,
  closeOpenShifts,
  productId,
  setStock,
  setTableStatus,
  signIn,
  stockOf,
  tableId,
  tableStatus,
  taxPercent,
  variantId,
} from "./helpers";

let owner: SupabaseClient;
let manager: SupabaseClient;
let cashier: SupabaseClient;
let kitchen: SupabaseClient;
let cashierId: string;
const P: Record<string, string> = {};
let kopiLarge: string;

const BASELINE: Record<string, number> = {
  Espresso: 5000,
  Susu: 30000,
  "Gula cair": 8000,
  "Bubuk matcha": 1500,
  "Roti tawar": 120,
  "Selai cokelat": 3000,
};
const line = (sku: string, quantity = 1, variant: string | null = null) => ({
  product_id: P[sku],
  variant_id: variant,
  quantity,
});

beforeAll(async () => {
  const [o, m, c, k] = await Promise.all(
    ["owner", "manager", "cashier", "kitchen"].map((r) => signIn(r as never))
  );
  owner = o.client;
  manager = m.client;
  cashier = c.client;
  kitchen = k.client;
  cashierId = c.id;

  for (const sku of ["KOP-001", "KOP-002", "NON-001", "MKN-001", "MKN-002"])
    P[sku] = await productId(sku);
  kopiLarge = await variantId("KOP-001", "Large");
  for (const [name, qty] of Object.entries(BASELINE)) await setStock(name, qty);
  await closeOpenShifts(cashierId);
});

afterAll(async () => {
  for (const [name, qty] of Object.entries(BASELINE)) await setStock(name, qty);
});

describe("checkout", () => {
  it("harga dihitung di server dan disimpan sebagai snapshot", async () => {
    const tax = await taxPercent();
    const { data: orderId, error } = await checkout(cashier, {
      lines: [
        { ...line("KOP-001", 2, kopiLarge), notes: "Less sugar" },
        line("MKN-001"),
      ],
    });
    expect(error).toBeNull();

    const { data: o } = await admin
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .eq("id", orderId)
      .single();
    const expected = computeTotals({
      subtotal: 27000 * 2 + 20000,
      discountType: "none",
      discountValue: 0,
      taxPercent: tax,
    });

    expect(o.subtotal).toBe(74000);
    expect(o.total_amount).toBe(expected.total);
    expect(o.payment_status).toBe("paid");
    expect(o.status).toBe("placed");
    expect(o.payments[0].amount).toBe(expected.total);

    const items = [...o.order_items].sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position
    );
    expect(items.map((i: { product_name: string }) => i.product_name)).toEqual([
      "Es Kopi Susu",
      "Roti Bakar Cokelat",
    ]);
    expect(items[0]).toMatchObject({
      variant_name: "Large",
      unit_price: 27000,
      quantity: 2,
      notes: "Less sugar",
      line_total: 54000,
    });
  });

  it("diskon: cashier ditolak, manager diterima dan dihitung server", async () => {
    const lines = [line("MKN-002", 2)]; // 36.000
    const denied = await checkout(cashier, {
      lines,
      discountType: "percent",
      discountValue: 10,
    });
    expect(denied.error?.message).toMatch(/diskon/i);

    const tax = await taxPercent();
    const { data: id, error } = await checkout(manager, {
      lines,
      discountType: "percent",
      discountValue: 10,
    });
    expect(error).toBeNull();

    const { data: o } = await admin
      .from("orders")
      .select("discount_amount, total_amount")
      .eq("id", id)
      .single();
    const expected = computeTotals({
      subtotal: 36000,
      discountType: "percent",
      discountValue: 10,
      taxPercent: tax,
    });
    expect(o).not.toBeNull();
    expect(o!.discount_amount).toBe(3600);
    expect(o!.total_amount).toBe(expected.total);
  });

  it("input tidak valid ditolak server", async () => {
    const bad = [
      { ...line("MKN-002"), quantity: 0 },
      { ...line("MKN-002"), quantity: 100 },
      { product_id: randomUUID(), variant_id: null, quantity: 1 },
    ];
    for (const l of bad) {
      const { error } = await checkout(cashier, { lines: [l] });
      expect(error, JSON.stringify(l)).not.toBeNull();
    }
    const empty = await checkout(cashier, { lines: [] });
    expect(empty.error?.message).toMatch(/Keranjang/);
  });

  it("produk nonaktif atau habis tidak bisa dipesan", async () => {
    try {
      await admin
        .from("products")
        .update({ is_active: false })
        .eq("id", P["MKN-002"]);
      expect(
        (await checkout(cashier, { lines: [line("MKN-002")] })).error?.message
      ).toMatch(/tidak tersedia/);

      await admin
        .from("products")
        .update({ is_active: true, is_available: false })
        .eq("id", P["MKN-002"]);
      expect(
        (await checkout(cashier, { lines: [line("MKN-002")] })).error?.message
      ).toMatch(/tidak tersedia/);
    } finally {
      await admin
        .from("products")
        .update({ is_active: true, is_available: true })
        .eq("id", P["MKN-002"]);
    }
  });

  it("retry dengan idempotency key sama tidak membuat pesanan atau pengurangan stok ganda", async () => {
    const key = randomUUID();
    const before = await stockOf("Espresso");
    const a = await checkout(cashier, { lines: [line("KOP-002")], key });
    const b = await checkout(cashier, { lines: [line("KOP-002")], key });

    expect(a.error).toBeNull();
    expect(b.data).toBe(a.data);
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", key);
    expect(count).toBe(1);
    expect(before - (await stockOf("Espresso"))).toBeCloseTo(18);
  });

  it("klik ganda bersamaan hanya membuat satu pesanan", async () => {
    const key = randomUUID();
    const before = await stockOf("Espresso");
    const results = await Promise.all([
      checkout(cashier, { lines: [line("KOP-002")], key }),
      checkout(cashier, { lines: [line("KOP-002")], key }),
    ]);
    expect(results.filter((r) => !r.error).length).toBeGreaterThanOrEqual(1);
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", key);
    expect(count).toBe(1);
    expect(before - (await stockOf("Espresso"))).toBeCloseTo(18);
  });
});

describe("stok", () => {
  it("berkurang sesuai resep dan tercatat sebagai mutasi penjualan", async () => {
    const before = {
      e: await stockOf("Espresso"),
      s: await stockOf("Susu"),
      g: await stockOf("Gula cair"),
    };
    const { data: orderId, error } = await checkout(cashier, {
      lines: [line("KOP-001", 2)],
    });
    expect(error).toBeNull();

    expect(before.e - (await stockOf("Espresso"))).toBeCloseTo(36);
    expect(before.s - (await stockOf("Susu"))).toBeCloseTo(300);
    expect(before.g - (await stockOf("Gula cair"))).toBeCloseTo(40);

    const { data: moves } = await admin
      .from("inventory_movements")
      .select("movement_type, quantity_delta, order_id")
      .eq("order_id", orderId);
    expect(moves).toHaveLength(3);
    expect(
      moves!.every((m) => m.movement_type === "sale" && m.quantity_delta < 0)
    ).toBe(true);
  });

  it("produk tanpa resep tidak mengurangi stok", async () => {
    const { data: orderId } = await checkout(cashier, {
      lines: [line("MKN-002", 3)],
    });
    const { count } = await admin
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);
    expect(count).toBe(0);
  });

  it("stok kurang membatalkan seluruh checkout (atomik)", async () => {
    const susu = await stockOf("Susu");
    await setStock("Bubuk matcha", 5); // matcha latte butuh 10 g
    try {
      const key = randomUUID();
      const { error } = await checkout(cashier, {
        lines: [line("NON-001")],
        key,
      });
      expect(error?.message).toMatch(/tidak cukup/);

      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("idempotency_key", key);
      expect(count).toBe(0);
      expect(await stockOf("Susu")).toBeCloseTo(susu);
      expect(await stockOf("Bubuk matcha")).toBeCloseTo(5);
    } finally {
      await setStock("Bubuk matcha", BASELINE["Bubuk matcha"]);
    }
  });

  it("dua checkout bersamaan tidak membuat stok negatif", async () => {
    await setStock("Roti tawar", 2); // satu roti bakar butuh 2 pcs
    try {
      const results = await Promise.all([
        checkout(cashier, { lines: [line("MKN-001")] }),
        checkout(cashier, { lines: [line("MKN-001")] }),
      ]);
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      expect(await stockOf("Roti tawar")).toBeCloseTo(0);
    } finally {
      await setStock("Roti tawar", BASELINE["Roti tawar"]);
    }
  });

  it("penyesuaian stok wajib beralasan dan tercatat di audit log", async () => {
    const { data: ing } = await admin
      .from("ingredients")
      .select("id")
      .eq("name", "Gula cair")
      .single();
    const noReason = await manager.rpc("record_stock_movement", {
      p_ingredient_id: ing!.id,
      p_type: "adjustment",
      p_quantity: 7000,
      p_reason: "",
    });
    expect(noReason.error?.message).toMatch(/Alasan/);

    const ok = await manager.rpc("record_stock_movement", {
      p_ingredient_id: ing!.id,
      p_type: "adjustment",
      p_quantity: 7000,
      p_reason: "Stok opname uji",
    });
    expect(ok.error).toBeNull();
    expect(await stockOf("Gula cair")).toBeCloseTo(7000);

    const { data: logs } = await owner
      .from("audit_logs")
      .select("metadata")
      .eq("action", "stock.adjustment")
      .eq("entity_id", ing!.id)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(logs![0].metadata).toMatchObject({
      stock_after: 7000,
      reason: "Stok opname uji",
    });
  });
});

describe("shift dan pembayaran tunai", () => {
  it("tunai ditolak tanpa shift, QRIS boleh", async () => {
    await closeOpenShifts(cashierId);
    expect(
      (await checkout(cashier, { lines: [line("MKN-002")], method: "cash" }))
        .error?.message
    ).toMatch(/shift/i);
    expect(
      (await checkout(cashier, { lines: [line("MKN-002")], method: "qris" }))
        .error
    ).toBeNull();
  });

  it("alur shift: buka, bayar tunai, kas keluar, tutup dengan selisih", async () => {
    const open = await cashier.rpc("open_shift", { p_opening: 100000 });
    expect(open.error).toBeNull();
    const shiftId = open.data as string;

    expect(
      (await cashier.rpc("open_shift", { p_opening: 1 })).error?.message
    ).toMatch(/masih memiliki shift/);

    const short = await checkout(cashier, {
      lines: [line("MKN-002")],
      method: "cash",
      tendered: 1000,
    });
    expect(short.error?.message).toMatch(/kurang/);

    const { data: orderId, error } = await checkout(cashier, {
      lines: [line("MKN-002")],
      method: "cash",
      tendered: 50000,
    });
    expect(error).toBeNull();
    const { data: o } = await admin
      .from("orders")
      .select("total_amount")
      .eq("id", orderId)
      .single();
    const { data: pay } = await admin
      .from("payments")
      .select("change_amount, shift_id")
      .eq("order_id", orderId)
      .single();
    expect(pay!.change_amount).toBe(50000 - o!.total_amount);
    expect(pay!.shift_id).toBe(shiftId);

    expect(
      (
        await cashier.rpc("add_cash_movement", {
          p_type: "out",
          p_amount: 5000,
          p_reason: "Beli es batu",
        })
      ).error
    ).toBeNull();

    const { data: s } = await cashier.rpc("shift_summary", {
      p_shift_id: shiftId,
    });
    expect(s.expected).toBe(100000 + o!.total_amount - 5000);

    const noNote = await cashier.rpc("close_shift", {
      p_closing: s.expected - 1000,
      p_note: "",
    });
    expect(noNote.error?.message).toMatch(/Catatan wajib/);

    const closed = await cashier.rpc("close_shift", {
      p_closing: s.expected - 1000,
      p_note: "Selisih uji",
    });
    expect(closed.error).toBeNull();

    const { data: sh } = await admin
      .from("shifts")
      .select("status, difference")
      .eq("id", shiftId)
      .single();
    expect(sh).toMatchObject({ status: "closed", difference: -1000 });

    expect(
      (await checkout(cashier, { lines: [line("MKN-002")], method: "cash" }))
        .error?.message
    ).toMatch(/shift/i);
  });
});

describe("alur dine-in dan dapur", () => {
  it("status berurutan, meja terisi sampai pelanggan pergi", async () => {
    await setTableStatus("T6", "available");
    const tid = await tableId("T6");
    const lines = [{ ...line("KOP-002"), notes: "Tanpa es" }];

    const { data: orderId, error } = await checkout(cashier, {
      type: "dine_in",
      tableId: tid,
      lines,
    });
    expect(error).toBeNull();
    expect(await tableStatus("T6")).toBe("occupied");

    const dup = await checkout(cashier, {
      type: "dine_in",
      tableId: tid,
      lines,
    });
    expect(dup.error?.message).toMatch(/tidak tersedia/);

    const { data: t } = await kitchen
      .from("kitchen_tickets")
      .select("*")
      .eq("order_id", orderId)
      .single();
    expect(t).toMatchObject({ status: "placed", table_number: "T6" });
    expect(t.items[0]).toMatchObject({
      name: "Americano",
      quantity: 1,
      notes: "Tanpa es",
    });

    const set = (c: SupabaseClient, to: string) =>
      c.rpc("set_order_status", { p_order_id: orderId, p_to: to });

    expect((await set(cashier, "preparing")).error?.message).toMatch(
      /Tidak diizinkan/
    );
    expect((await set(kitchen, "preparing")).error).toBeNull();
    expect((await set(kitchen, "served")).error).not.toBeNull(); // lompat status
    expect((await set(kitchen, "ready")).error).toBeNull();
    expect((await set(kitchen, "served")).error?.message).toMatch(
      /Tidak diizinkan/
    );
    expect((await set(cashier, "completed")).error?.message).toMatch(/diantar/);

    expect((await set(cashier, "served")).error).toBeNull();
    expect(await tableStatus("T6")).toBe("occupied");

    expect((await set(cashier, "completed")).error).toBeNull();
    expect(await tableStatus("T6")).toBe("available");
  });

  it("takeaway: diserahkan langsung, tidak melewati status diantar", async () => {
    const { data: orderId } = await checkout(cashier, {
      lines: [line("MKN-002")],
    });
    const set = (c: SupabaseClient, to: string) =>
      c.rpc("set_order_status", { p_order_id: orderId, p_to: to });

    await set(kitchen, "preparing");
    await set(kitchen, "ready");
    expect((await set(cashier, "served")).error?.message).toMatch(/Takeaway/);
    expect((await set(cashier, "completed")).error).toBeNull();
  });
});

describe("refund", () => {
  it("hanya manager/owner, tercermin di laporan, stok tidak kembali, tercatat di audit", async () => {
    const range = {
      p_from: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      p_to: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const summary = async () =>
      (await manager.rpc("report_summary", range)).data[0];
    const start = await summary();

    const { data: orderId } = await checkout(cashier, {
      lines: [line("KOP-002")],
    });
    const { data: o } = await admin
      .from("orders")
      .select("total_amount")
      .eq("id", orderId)
      .single();
    const afterSale = await summary();
    expect(Number(afterSale.net_sales) - Number(start.net_sales)).toBe(
      o!.total_amount
    );

    const stock = await stockOf("Espresso");

    expect(
      (
        await cashier.rpc("refund_order", {
          p_order_id: orderId,
          p_reason: "Salah pesan",
        })
      ).error?.message
    ).toMatch(/Tidak diizinkan/);
    expect(
      (
        await manager.rpc("refund_order", {
          p_order_id: orderId,
          p_reason: "x",
        })
      ).error?.message
    ).toMatch(/Alasan/);
    expect(
      (
        await manager.rpc("refund_order", {
          p_order_id: orderId,
          p_reason: "Salah pesan",
        })
      ).error
    ).toBeNull();

    const afterRefund = await summary();
    expect(Number(afterRefund.net_sales)).toBe(Number(start.net_sales));
    expect(Number(afterRefund.refund_count)).toBe(
      Number(start.refund_count) + 1
    );

    const { data: order } = await admin
      .from("orders")
      .select("status, payment_status")
      .eq("id", orderId)
      .single();
    expect(order).toMatchObject({
      status: "cancelled",
      payment_status: "refunded",
    });
    expect(await stockOf("Espresso")).toBeCloseTo(stock);

    expect(
      (
        await manager.rpc("refund_order", {
          p_order_id: orderId,
          p_reason: "Dua kali",
        })
      ).error?.message
    ).toMatch(/tidak dapat direfund/);

    const { data: logs } = await owner
      .from("audit_logs")
      .select("metadata")
      .eq("action", "order.refunded")
      .eq("entity_id", orderId);
    expect(logs).toHaveLength(1);
    expect(logs![0].metadata).toMatchObject({
      reason: "Salah pesan",
      stock_restored: false,
    });
  });
});

describe("audit dan akun", () => {
  it("perubahan harga tercatat dan tidak mengubah pesanan lama", async () => {
    const { data: p0 } = await admin
      .from("products")
      .select("price")
      .eq("id", P["KOP-002"])
      .single();
    const { data: orderId } = await checkout(cashier, {
      lines: [line("KOP-002")],
    });

    try {
      const upd = await owner
        .from("products")
        .update({ price: p0!.price + 1000 })
        .eq("id", P["KOP-002"])
        .select("price");
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(1);

      const { data: logs } = await owner
        .from("audit_logs")
        .select("metadata")
        .eq("action", "product.price_changed")
        .eq("entity_id", P["KOP-002"])
        .order("created_at", { ascending: false })
        .limit(1);
      expect(logs![0].metadata).toMatchObject({
        old_price: p0!.price,
        new_price: p0!.price + 1000,
      });

      const { data: item } = await admin
        .from("order_items")
        .select("unit_price")
        .eq("order_id", orderId)
        .single();
      expect(item!.unit_price).toBe(p0!.price);
    } finally {
      await admin
        .from("products")
        .update({ price: p0!.price })
        .eq("id", P["KOP-002"]);
    }
  });

  it("akun nonaktif langsung ditolak walau sesi masih ada", async () => {
    await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", cashierId);
    try {
      const r = await checkout(cashier, { lines: [line("MKN-002")] });
      expect(r.error?.message).toMatch(/Tidak diizinkan/);
      const { data } = await cashier.from("products").select("id");
      expect(data).toEqual([]);
    } finally {
      await admin
        .from("profiles")
        .update({ is_active: true })
        .eq("id", cashierId);
    }
  });
});
