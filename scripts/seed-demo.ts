import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoRole } from "./demo-accounts";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} belum diisi`);
  return v;
}

const url = need("NEXT_PUBLIC_SUPABASE_URL");
const anon = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = need("SUPABASE_SERVICE_ROLE_KEY");

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
if (!isLocal && !process.argv.includes("--confirm")) {
  console.error(
    `Target ${url} bukan lokal. Tambahkan --confirm bila yakin (akun demo akan dibuat dan passwordnya direset).`
  );
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, opts);

type Res = { data: unknown; error: { message: string } | null };

// wajib ada hasil; melempar bila error atau kosong
async function ok<T = { id: string }>(res: Res, label: string): Promise<T> {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  if (res.data === null || res.data === undefined)
    throw new Error(`${label}: data tidak ditemukan`);
  return res.data as T;
}

// untuk pencarian "sudah ada atau belum" (.maybeSingle()): kosong itu wajar
async function maybe<T = { id: string }>(
  res: Res,
  label: string
): Promise<T | null> {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return (res.data ?? null) as T | null;
}
async function ensureId(
  find: PromiseLike<Res>,
  create: () => PromiseLike<Res>,
  label: string
): Promise<string> {
  const found = await maybe<{ id: string }>(await find, label);
  if (found) return found.id;
  const created = await ok<{ id: string }>(await create(), label);
  return created.id;
}

async function ensureUser(role: DemoRole) {
  const { email, name } = DEMO_ACCOUNTS[role];
  const created = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  let id: string | undefined = created.data.user?.id;
  if (!id) {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    id = list.data.users.find((u) => u.email === email)?.id;
    if (!id)
      throw new Error(`Gagal membuat ${email}: ${created.error?.message}`);
    await admin.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
  }
  // akun baru tidak aktif secara default (migration hardening); seed mengaktifkannya
  await ok<unknown[]>(
    await admin
      .from("profiles")
      .update({ role, full_name: name, is_active: true })
      .eq("id", id)
      .select("id"),
    `profil ${role}`
  );
}

async function signIn(role: DemoRole): Promise<SupabaseClient> {
  const client = createClient(url, anon, opts);
  const { error } = await client.auth.signInWithPassword({
    email: DEMO_ACCOUNTS[role].email,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`Login ${role} gagal: ${error.message}`);
  return client;
}

// ---------- data master ----------
type Demo = {
  sku: string;
  name: string;
  cat: string;
  price: number;
  variants: [string, number][];
  recipe: Record<string, number>;
};

const CATEGORIES = [
  { name: "Kopi", sort_order: 1 },
  { name: "Non-Kopi", sort_order: 2 },
  { name: "Makanan", sort_order: 3 },
];

const INGREDIENTS = [
  { name: "Espresso", unit: "g", min: 300, initial: 5000 },
  { name: "Susu", unit: "ml", min: 2000, initial: 30000 },
  { name: "Gula cair", unit: "ml", min: 500, initial: 8000 },
  { name: "Bubuk matcha", unit: "g", min: 100, initial: 1500 },
  { name: "Roti tawar", unit: "pcs", min: 10, initial: 120 },
  { name: "Selai cokelat", unit: "g", min: 200, initial: 3000 },
];

const PRODUCTS: Demo[] = [
  {
    sku: "KOP-001",
    name: "Es Kopi Susu",
    cat: "Kopi",
    price: 22000,
    variants: [
      ["Regular", 0],
      ["Large", 5000],
    ],
    recipe: { Espresso: 18, Susu: 150, "Gula cair": 20 },
  },
  {
    sku: "KOP-002",
    name: "Americano",
    cat: "Kopi",
    price: 18000,
    variants: [
      ["Regular", 0],
      ["Large", 4000],
    ],
    recipe: { Espresso: 18 },
  },
  {
    sku: "KOP-003",
    name: "Cappuccino",
    cat: "Kopi",
    price: 24000,
    variants: [],
    recipe: { Espresso: 18, Susu: 120 },
  },
  {
    sku: "NON-001",
    name: "Matcha Latte",
    cat: "Non-Kopi",
    price: 25000,
    variants: [],
    recipe: { "Bubuk matcha": 10, Susu: 150 },
  },
  {
    sku: "MKN-001",
    name: "Roti Bakar Cokelat",
    cat: "Makanan",
    price: 20000,
    variants: [],
    recipe: { "Roti tawar": 2, "Selai cokelat": 25 },
  },
  // sengaja tanpa resep: tidak mengurangi stok bahan
  {
    sku: "MKN-002",
    name: "Kentang Goreng",
    cat: "Makanan",
    price: 18000,
    variants: [],
    recipe: {},
  },
];

const TABLES: [string, number][] = [
  ["T1", 2],
  ["T2", 2],
  ["T3", 4],
  ["T4", 4],
  ["T5", 6],
  ["T6", 8],
];

async function ensureMasterData(owner: SupabaseClient) {
  const catId = new Map<string, string>();
  for (const c of CATEGORIES) {
    const id = await ensureId(
      owner.from("categories").select("id").ilike("name", c.name).maybeSingle(),
      () => owner.from("categories").insert(c).select("id").single(),
      "kategori"
    );
    catId.set(c.name, id);
  }

  const ingId = new Map<string, string>();
  for (const i of INGREDIENTS) {
    const found = await maybe<{ id: string }>(
      await owner
        .from("ingredients")
        .select("id")
        .ilike("name", i.name)
        .maybeSingle(),
      "bahan"
    );
    if (found) {
      ingId.set(i.name, found.id);
      continue;
    }
    const res = await owner.rpc("create_ingredient", {
      p_name: i.name,
      p_unit: i.unit,
      p_minimum: i.min,
      p_initial: i.initial,
    });
    if (res.error) throw new Error(`bahan ${i.name}: ${res.error.message}`);
    ingId.set(i.name, res.data as string);
  }

  for (const p of PRODUCTS) {
    const productId = await ensureId(
      owner.from("products").select("id").eq("sku", p.sku).maybeSingle(),
      () =>
        owner
          .from("products")
          .insert({
            sku: p.sku,
            name: p.name,
            category_id: catId.get(p.cat),
            price: p.price,
          })
          .select("id")
          .single(),
      "produk"
    );

    const { count } = await owner
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (!count && p.variants.length) {
      await ok<unknown[]>(
        await owner
          .from("product_variants")
          .insert(
            p.variants.map(([name, price_delta]) => ({
              product_id: productId,
              name,
              price_delta,
            }))
          )
          .select("id"),
        "varian"
      );
    }

    for (const [ing, qty] of Object.entries(p.recipe)) {
      await ok<unknown[]>(
        await owner
          .from("product_recipes")
          .upsert(
            {
              product_id: productId,
              ingredient_id: ingId.get(ing),
              quantity_required: qty,
            },
            { onConflict: "product_id,ingredient_id" }
          )
          .select("id"),
        "resep"
      );
    }
  }

  for (const [table_number, capacity] of TABLES) {
    await ensureId(
      owner
        .from("dining_tables")
        .select("id")
        .ilike("table_number", table_number)
        .maybeSingle(),
      () =>
        owner
          .from("dining_tables")
          .insert({ table_number, capacity })
          .select("id")
          .single(),
      "meja"
    );
  }

  await ok<unknown[]>(
    await owner
      .from("app_settings")
      .update({
        cafe_name: "Kopi Senja",
        address: "Jl. Melati No. 12, Jawa Tengah",
        phone: "0285-123456",
        receipt_footer: "Terima kasih, sampai jumpa lagi!",
      })
      .eq("id", true)
      .select("id"),
    "pengaturan"
  );
}

// ---------- riwayat transaksi ----------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Line = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  notes: string | null;
};

async function place(
  client: SupabaseClient,
  o: {
    type: "dine_in" | "takeaway";
    tableId?: string;
    lines: Line[];
    method: string;
  }
): Promise<string> {
  const { data, error } = await client.rpc("create_order_checkout", {
    p_idempotency_key: randomUUID(),
    p_order_type: o.type,
    p_table_id: o.tableId ?? null,
    p_items: o.lines,
    p_discount_type: "none",
    p_discount_value: 0,
    p_payment_method: o.method,
    p_tendered: o.method === "cash" ? 10_000_000 : null,
    p_reference: null,
  });
  if (error) throw new Error(`checkout: ${error.message}`);
  return data as string;
}

const ymdJakarta = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
});

async function seedHistory(
  cashier: SupabaseClient,
  manager: SupabaseClient,
  kitchen: SupabaseClient
) {
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log("• Riwayat pesanan dilewati (sudah ada pesanan).");
    return;
  }

  const products = await ok<{ id: string; sku: string }[]>(
    await admin.from("products").select("id, sku").eq("is_active", true),
    "produk"
  );
  const variants = await ok<{ id: string; product_id: string }[]>(
    await admin.from("product_variants").select("id, product_id"),
    "varian"
  );
  const variantsOf = new Map<string, string[]>();
  for (const v of variants)
    variantsOf.set(v.product_id, [
      ...(variantsOf.get(v.product_id) ?? []),
      v.id,
    ]);
  const idBySku = new Map(products.map((p) => [p.sku, p.id]));

  const rng = mulberry32(20261017);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const shiftId = await ok<string>(
    await cashier.rpc("open_shift", { p_opening: 200000 }),
    "buka shift"
  );

  const created: { id: string; method: string; at: Date }[] = [];
  for (let n = 0; n < 36; n++) {
    const wanted = 1 + Math.floor(rng() * 3);
    const chosen = new Set<string>();
    while (chosen.size < wanted) chosen.add(pick(products).id);

    const lines: Line[] = [...chosen].map((id) => {
      const vs = variantsOf.get(id) ?? [];
      return {
        product_id: id,
        variant_id: vs.length ? pick(vs) : null,
        quantity: 1 + Math.floor(rng() * 2),
        notes: rng() < 0.1 ? "Less sugar" : null,
      };
    });

    const r = rng();
    const method =
      r < 0.45
        ? "cash"
        : r < 0.8
        ? "qris"
        : r < 0.95
        ? "bank_transfer"
        : "other";
    const id = await place(cashier, { type: "takeaway", lines, method });

    const day = new Date(Date.now() - Math.floor(rng() * 7) * 86_400_000);
    day.setUTCHours(1 + Math.floor(rng() * 14), Math.floor(rng() * 60), 0, 0); // 08:00-21:59 WIB
    const at =
      day.getTime() > Date.now() ? new Date(Date.now() - 30 * 60_000) : day;
    created.push({ id, method, at });
  }

  await ok(
    await cashier.rpc("add_cash_movement", {
      p_type: "out",
      p_amount: 15000,
      p_reason: "Beli es batu",
    }),
    "kas keluar"
  ).catch(() => undefined); // fungsi ini tidak mengembalikan data; error sungguhan ditangani di bawah
  const cashRes = await cashier.rpc("shift_summary", { p_shift_id: shiftId });
  const summary = await ok<{ expected: number }>(cashRes, "ringkasan shift");

  const closeRes = await cashier.rpc("close_shift", {
    p_closing: summary.expected - 2000,
    p_note: "Selisih kecil, kembalian kurang",
  });
  if (closeRes.error) throw new Error(`tutup shift: ${closeRes.error.message}`);

  // pindahkan tanggal transaksi ke 7 hari terakhir; nomor 09xx menandai data demo
  for (let i = 0; i < created.length; i++) {
    const o = created[i];
    const at = o.at.toISOString();
    const number = `CF-${ymdJakarta.format(o.at).replaceAll("-", "")}-${String(
      901 + i
    ).padStart(4, "0")}`;
    await ok<unknown[]>(
      await admin
        .from("orders")
        .update({ created_at: at, order_number: number, status: "completed" })
        .eq("id", o.id)
        .select("id"),
      "ubah tanggal pesanan"
    );
    await admin
      .from("kitchen_tickets")
      .update({ order_number: number })
      .eq("order_id", o.id);
    await admin
      .from("payments")
      .update({ created_at: at })
      .eq("order_id", o.id);
    await admin
      .from("inventory_movements")
      .update({ created_at: at, reason: `Penjualan ${number}` })
      .eq("order_id", o.id)
      .eq("movement_type", "sale");
  }

  const qris = created.find((o) => o.method === "qris");
  if (qris) {
    const refund = await manager.rpc("refund_order", {
      p_order_id: qris.id,
      p_reason: "Pesanan salah input",
    });
    if (refund.error) throw new Error(`refund: ${refund.error.message}`);
  }

  // dua pesanan aktif agar KDS dan halaman Meja terlihat hidup
  const tables = await ok<{ id: string; table_number: string }[]>(
    await admin
      .from("dining_tables")
      .select("id, table_number")
      .in("table_number", ["T1", "T2"]),
    "meja"
  );
  const t1 = tables.find((t) => t.table_number === "T1");
  const t2 = tables.find((t) => t.table_number === "T2");
  await admin
    .from("dining_tables")
    .update({ status: "available" })
    .in("table_number", ["T1", "T2"]);

  const line = (sku: string, quantity = 1): Line => ({
    product_id: idBySku.get(sku) ?? "",
    variant_id: null,
    quantity,
    notes: null,
  });
  if (t1 && t2) {
    await place(cashier, {
      type: "dine_in",
      tableId: t1.id,
      lines: [line("KOP-002"), line("MKN-002")],
      method: "qris",
    });
    const b = await place(cashier, {
      type: "dine_in",
      tableId: t2.id,
      lines: [line("KOP-001", 2)],
      method: "qris",
    });
    const st = await kitchen.rpc("set_order_status", {
      p_order_id: b,
      p_to: "preparing",
    });
    if (st.error) throw new Error(`status dapur: ${st.error.message}`);
  }

  console.log(
    "• Riwayat 36 pesanan, 1 refund, 1 shift, dan 2 pesanan aktif dibuat."
  );
}

async function main() {
  console.log(`Target: ${url}`);
  for (const role of Object.keys(DEMO_ACCOUNTS) as DemoRole[])
    await ensureUser(role);
  console.log("• Akun demo siap.");

  const [owner, manager, cashier, kitchen] = await Promise.all(
    (["owner", "manager", "cashier", "kitchen"] as DemoRole[]).map(signIn)
  );
  await ensureMasterData(owner);
  console.log("• Menu, varian, resep, bahan, meja, dan pengaturan siap.");
  await seedHistory(cashier, manager, kitchen);

  console.log("\nAkun demo:");
  for (const [role, a] of Object.entries(DEMO_ACCOUNTS))
    console.log(`  ${role.padEnd(8)} ${a.email}`);
  console.log(`  password ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
