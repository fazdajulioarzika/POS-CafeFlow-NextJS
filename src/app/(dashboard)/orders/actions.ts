"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cfMessage } from "@/lib/db-error";
import { refundSchema } from "@/lib/validations/shift";
import type { ActionState } from "@/types/action";

const schema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(["preparing", "ready", "served", "completed"]),
});

export type StatusResult = { ok: true } | { ok: false; error: string };

export async function setOrderStatus(
  orderId: string,
  to: "preparing" | "ready" | "served" | "completed"
): Promise<StatusResult> {
  await getCurrentProfile(); // wajib login; role dan transisi diperiksa ulang di database

  const parsed = schema.safeParse({ orderId, to });
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: parsed.data.orderId,
    p_to: parsed.data.to,
  });

  if (error) {
    const msg = error.message.startsWith("CF:")
      ? error.message.slice(3)
      : "Gagal mengubah status";
    return { ok: false, error: msg };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath("/tables");
  return { ok: true };
}
export async function refundOrder(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentProfile();
  if (!["owner", "manager"].includes(me.role))
    return { error: "Tidak diizinkan" };

  const parsed = refundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_order", {
    p_order_id: parsed.data.order_id,
    p_reason: parsed.data.reason,
  });
  if (error)
    return {
      error: cfMessage(error.message, "Refund gagal. Silakan coba lagi."),
    };

  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.order_id}`);
  revalidatePath("/tables");
  revalidatePath("/kitchen");
  return { success: "Pesanan dibatalkan dan direfund" };
}
