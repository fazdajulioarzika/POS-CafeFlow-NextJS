"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validations/checkout";

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function checkout(input: unknown): Promise<CheckoutResult> {
  const me = await getCurrentProfile();
  if (!["owner", "manager", "cashier"].includes(me.role)) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (v.discount_type !== "none" && me.role === "cashier") {
    return { ok: false, error: "Cashier tidak boleh memberi diskon" };
  }

  const supabase = await createClient();
  const args = {
    p_idempotency_key: v.idempotency_key,
    p_order_type: v.order_type,
    p_table_id: v.order_type === "dine_in" ? v.table_id : null,
    p_items: v.items,
    p_discount_type: v.discount_type,
    p_discount_value: v.discount_type === "none" ? 0 : v.discount_value,
    p_payment_method: v.payment_method,
    p_tendered: v.payment_method === "cash" ? v.tendered : null,
    p_reference: v.reference,
  };

  // `as never`: tipe hasil generate tidak menerima null pada argumen fungsi
  const { data, error } = await supabase.rpc(
    "create_order_checkout",
    args as never
  );

  if (error) {
    // request ganda yang bersamaan: kembalikan pesanan yang sudah terbentuk
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("idempotency_key", v.idempotency_key)
        .maybeSingle();
      if (existing) return { ok: true, orderId: existing.id };
    }
    const msg = error.message.startsWith("CF:")
      ? error.message.slice(3)
      : "Checkout gagal. Silakan coba lagi.";
    return { ok: false, error: msg };
  }

  revalidatePath("/orders");
  revalidatePath("/tables");
  return { ok: true, orderId: data as unknown as string };
}
