import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  type DemoRole,
} from "../../scripts/demo-accounts";

function need(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(
      `${name} belum diisi. Buat .env.test.local (lihat README).`
    );
  return v;
}

const URL_ = need("NEXT_PUBLIC_SUPABASE_URL");
const ANON = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = need("SUPABASE_SERVICE_ROLE_KEY");

if (
  !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL_) &&
  process.env.ALLOW_REMOTE_TEST !== "yes"
) {
  throw new Error(
    `Tes integrasi hanya boleh ke Supabase lokal, bukan ${URL_}.`
  );
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(URL_, SERVICE, opts);
export const anonClient = () => createClient(URL_, ANON, opts);

export async function signIn(
  role: DemoRole
): Promise<{ client: SupabaseClient; id: string }> {
  const client = createClient(URL_, ANON, opts);
  const { data, error } = await client.auth.signInWithPassword({
    email: DEMO_ACCOUNTS[role].email,
    password: DEMO_PASSWORD,
  });
  if (error || !data.user)
    throw new Error(
      `Login ${role} gagal (${error?.message}). Jalankan seed dulu.`
    );
  return { client, id: data.user.id };
}

// data bertipe unknown, hasil di-cast ke T yang kita sebutkan; null/error selalu melempar
function unwrap<T>(
  res: { data: unknown; error: { message: string } | null },
  label: string
): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  if (res.data === null || res.data === undefined)
    throw new Error(`${label}: data tidak ditemukan`);
  return res.data as T;
}

export async function productId(sku: string): Promise<string> {
  const row = unwrap<{ id: string }>(
    await admin.from("products").select("id").eq("sku", sku).single(),
    `produk ${sku}`
  );
  return row.id;
}

export async function variantId(sku: string, name: string): Promise<string> {
  const pid = await productId(sku);
  const row = unwrap<{ id: string }>(
    await admin
      .from("product_variants")
      .select("id")
      .eq("product_id", pid)
      .eq("name", name)
      .single(),
    `varian ${name}`
  );
  return row.id;
}

export async function stockOf(name: string): Promise<number> {
  const row = unwrap<{ stock_quantity: number | string }>(
    await admin
      .from("ingredients")
      .select("stock_quantity")
      .eq("name", name)
      .single(),
    `stok ${name}`
  );
  return Number(row.stock_quantity);
}

export async function setStock(name: string, qty: number) {
  unwrap<unknown[]>(
    await admin
      .from("ingredients")
      .update({ stock_quantity: qty })
      .eq("name", name)
      .select("id"),
    `set stok ${name}`
  );
}

export async function tableId(number: string): Promise<string> {
  const row = unwrap<{ id: string }>(
    await admin
      .from("dining_tables")
      .select("id")
      .eq("table_number", number)
      .single(),
    `meja ${number}`
  );
  return row.id;
}

export async function tableStatus(number: string): Promise<string> {
  const row = unwrap<{ status: string }>(
    await admin
      .from("dining_tables")
      .select("status")
      .eq("table_number", number)
      .single(),
    `status meja ${number}`
  );
  return row.status;
}

export async function setTableStatus(number: string, status: string) {
  unwrap<unknown[]>(
    await admin
      .from("dining_tables")
      .update({ status })
      .eq("table_number", number)
      .select("id"),
    "status meja"
  );
}

export async function taxPercent(): Promise<number> {
  const row = unwrap<{ tax_percent: number | string }>(
    await admin.from("app_settings").select("tax_percent").single(),
    "pajak"
  );
  return Number(row.tax_percent);
}

export async function closeOpenShifts(userId: string) {
  const res = await admin
    .from("shifts")
    .update({
      status: "closed",
      closing_cash: 0,
      expected_cash: 0,
      difference: 0,
      closed_at: new Date().toISOString(),
    })
    .eq("cashier_id", userId)
    .eq("status", "open")
    .select("id");
  if (res.error) throw new Error(`tutup shift: ${res.error.message}`);
}

export type Line = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  notes?: string | null;
};

export function checkout(
  client: SupabaseClient,
  o: {
    lines: Line[];
    type?: "dine_in" | "takeaway";
    tableId?: string | null;
    method?: "cash" | "qris" | "bank_transfer" | "other";
    tendered?: number | null;
    discountType?: "none" | "amount" | "percent";
    discountValue?: number;
    key?: string;
  }
) {
  const method = o.method ?? "qris";
  return client.rpc("create_order_checkout", {
    p_idempotency_key: o.key ?? randomUUID(),
    p_order_type: o.type ?? "takeaway",
    p_table_id: o.tableId ?? null,
    p_items: o.lines.map((l) => ({ notes: null, ...l })),
    p_discount_type: o.discountType ?? "none",
    p_discount_value: o.discountValue ?? 0,
    p_payment_method: method,
    p_tendered: method === "cash" ? o.tendered ?? 10_000_000 : null,
    p_reference: null,
  });
}
