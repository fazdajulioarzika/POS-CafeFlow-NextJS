import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_ACCOUNTS } from "../../scripts/demo-accounts";
import { admin, anonClient, signIn } from "./helpers";

let owner: SupabaseClient;
let manager: SupabaseClient;
let cashier: SupabaseClient;
let kitchen: SupabaseClient;
let cashierId: string;

beforeAll(async () => {
  const [o, m, c, k] = await Promise.all(
    ["owner", "manager", "cashier", "kitchen"].map((r) => signIn(r as never))
  );
  owner = o.client;
  manager = m.client;
  cashier = c.client;
  kitchen = k.client;
  cashierId = c.id;
});

const SEEDED = [
  "orders",
  "order_items",
  "payments",
  "refunds",
  "ingredients",
  "inventory_movements",
  "product_recipes",
  "audit_logs",
  "shifts",
];

describe("prasyarat", () => {
  it.each(SEEDED)("seed menyediakan data di %s", async (table) => {
    const { count } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    expect(count ?? 0).toBeGreaterThan(0);
  });
});

describe("akses baca dibatasi per role", () => {
  const cases: { who: string; get: () => SupabaseClient; tables: string[] }[] =
    [
      { who: "kitchen", get: () => kitchen, tables: SEEDED },
      {
        who: "cashier",
        get: () => cashier,
        tables: [
          "ingredients",
          "inventory_movements",
          "product_recipes",
          "audit_logs",
        ],
      },
      { who: "manager", get: () => manager, tables: ["audit_logs"] },
      {
        who: "anon",
        get: () => anonClient(),
        tables: [
          "products",
          "orders",
          "profiles",
          "dining_tables",
          "app_settings",
        ],
      },
    ];
  for (const c of cases) {
    for (const table of c.tables) {
      it(`${c.who} tidak melihat isi ${table}`, async () => {
        const { data, error } = await c.get().from(table).select("*").limit(5);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });
    }
  }

  it("kitchen membaca tiket dapur tanpa data uang", async () => {
    const { data, error } = await kitchen
      .from("kitchen_tickets")
      .select("*")
      .limit(1);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(
      Object.keys(data![0]).filter((k) => /price|total|amount|payment/.test(k))
    ).toEqual([]);
  });

  it("cashier hanya melihat profilnya sendiri", async () => {
    const { data } = await cashier.from("profiles").select("id");
    expect(data).toEqual([{ id: cashierId }]);
  });
});

describe("tulis langsung ditolak", () => {
  it("cashier tidak bisa mengubah harga produk", async () => {
    const { data: p } = await admin
      .from("products")
      .select("id, price")
      .eq("sku", "KOP-001")
      .single();
    await cashier.from("products").update({ price: 1 }).eq("id", p!.id);
    const { data: after } = await admin
      .from("products")
      .select("price")
      .eq("id", p!.id)
      .single();
    expect(after!.price).toBe(p!.price);
  });

  it("cashier tidak bisa membuat kategori", async () => {
    const { error } = await cashier
      .from("categories")
      .insert({ name: "Hack", sort_order: 0 });
    expect(error).not.toBeNull();
  });

  it("cashier tidak bisa menaikkan role sendiri", async () => {
    await cashier
      .from("profiles")
      .update({ role: "owner" })
      .eq("id", cashierId);
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", cashierId)
      .single();
    expect(data!.role).toBe("cashier");
  });

  it("manager tidak bisa mengubah profil orang lain", async () => {
    await manager
      .from("profiles")
      .update({ full_name: "Hacked" })
      .eq("id", cashierId);
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", cashierId)
      .single();
    expect(data!.full_name).toBe(DEMO_ACCOUNTS.cashier.name);
  });

  it("cashier tidak bisa menyisipkan pesanan atau pembayaran langsung", async () => {
    const o = await cashier.from("orders").insert({
      order_number: "HACK-1",
      idempotency_key: crypto.randomUUID(),
      order_type: "takeaway",
      cashier_id: cashierId,
    });
    expect(o.error).not.toBeNull();
    const { data: any1 } = await admin
      .from("orders")
      .select("id")
      .limit(1)
      .single();
    const p = await cashier.from("payments").insert({
      order_id: any1!.id,
      method: "cash",
      amount: 1,
      tendered: 1,
      processed_by: cashierId,
    });
    expect(p.error).not.toBeNull();
  });

  it("cashier tidak bisa mengubah total pesanan", async () => {
    const { data: o } = await admin
      .from("orders")
      .select("id, total_amount")
      .eq("cashier_id", cashierId)
      .limit(1)
      .single();
    await cashier.from("orders").update({ total_amount: 0 }).eq("id", o!.id);
    const { data: after } = await admin
      .from("orders")
      .select("total_amount")
      .eq("id", o!.id)
      .single();
    expect(after!.total_amount).toBe(o!.total_amount);
  });

  it("stok tidak bisa ditimpa dari browser, bahkan oleh owner", async () => {
    const { data: before } = await admin
      .from("ingredients")
      .select("stock_quantity")
      .eq("name", "Susu")
      .single();
    const { error } = await owner
      .from("ingredients")
      .update({ stock_quantity: 99999 })
      .eq("name", "Susu");
    expect(error).not.toBeNull();
    const { data: after } = await admin
      .from("ingredients")
      .select("stock_quantity")
      .eq("name", "Susu")
      .single();
    expect(after!.stock_quantity).toBe(before!.stock_quantity);
  });

  it("bahan tidak bisa dibuat langsung (harus lewat create_ingredient)", async () => {
    const { error } = await owner
      .from("ingredients")
      .insert({ name: "Langsung", unit: "g", stock_quantity: 100 });
    expect(error).not.toBeNull();
  });

  it("audit log tidak bisa ditambah atau dihapus oleh siapa pun", async () => {
    const ins = await owner
      .from("audit_logs")
      .insert({ action: "x", entity_type: "x" });
    expect(ins.error).not.toBeNull();

    const before = await admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true });
    await owner.from("audit_logs").delete().neq("id", 0);
    const after = await admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });

  it("produk dan pesanan tidak bisa dihapus permanen", async () => {
    await owner.from("products").delete().eq("sku", "KOP-002");
    await owner.from("orders").delete().neq("order_number", "");
    const { count: p } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("sku", "KOP-002");
    const { count: o } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true });
    expect(p).toBe(1);
    expect(o ?? 0).toBeGreaterThan(0);
  });

  it("cashier tidak bisa mengunggah foto produk", async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], {
      type: "image/png",
    });
    const { error } = await cashier.storage
      .from("product-images")
      .upload("tes/rls.png", blob);
    expect(error).not.toBeNull();
  });
});

describe("fungsi sensitif memeriksa role", () => {
  it("cashier tidak bisa refund, tambah bahan, atau catat stok", async () => {
    const { data: o } = await admin
      .from("orders")
      .select("id")
      .eq("payment_status", "paid")
      .limit(1)
      .single();
    const { data: ing } = await admin
      .from("ingredients")
      .select("id")
      .limit(1)
      .single();

    const refund = await cashier.rpc("refund_order", {
      p_order_id: o!.id,
      p_reason: "coba coba",
    });
    expect(refund.error?.message).toMatch(/Tidak diizinkan/);

    const create = await cashier.rpc("create_ingredient", {
      p_name: "X",
      p_unit: "g",
      p_minimum: 0,
      p_initial: 0,
    });
    expect(create.error?.message).toMatch(/Tidak diizinkan/);

    const move = await cashier.rpc("record_stock_movement", {
      p_ingredient_id: ing!.id,
      p_type: "purchase",
      p_quantity: 10,
      p_reason: "x",
    });
    expect(move.error?.message).toMatch(/Tidak diizinkan/);
  });

  it("kitchen dan anon tidak bisa checkout", async () => {
    const args = {
      p_idempotency_key: crypto.randomUUID(),
      p_order_type: "takeaway",
      p_table_id: null,
      p_items: [],
      p_discount_type: "none",
      p_discount_value: 0,
      p_payment_method: "qris",
      p_tendered: null,
      p_reference: null,
    };
    const k = await kitchen.rpc("create_order_checkout", args);
    expect(k.error?.message).toMatch(/Tidak diizinkan/);
    const a = await anonClient().rpc("create_order_checkout", args);
    expect(a.error).not.toBeNull();
  });
});

describe("akun", () => {
  it("pendaftaran publik ditutup", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: `intruder-${Date.now()}@example.com`,
      password: "Intruder12345!",
    });
    if (data.user) await admin.auth.admin.deleteUser(data.user.id); // bersihkan jika ternyata terbuka
    expect(error).not.toBeNull();
  });

  it("akun baru tidak aktif sampai disetujui owner", async () => {
    const { data } = await admin.auth.admin.createUser({
      email: `baru-${Date.now()}@example.com`,
      password: "Sementara12345!",
      email_confirm: true,
    });
    const { data: prof } = await admin
      .from("profiles")
      .select("is_active")
      .eq("id", data.user!.id)
      .single();
    await admin.auth.admin.deleteUser(data.user!.id);
    expect(prof!.is_active).toBe(false);
  });
});
