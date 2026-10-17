"use client";

import { useActionState, useState } from "react";
import { refundOrder } from "@/app/(dashboard)/orders/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RefundForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(
    refundOrder,
    {} as ActionState
  );
  const [sure, setSure] = useState(false);

  return (
    <form action={action} className="grid max-w-md gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="space-y-2">
        <Label htmlFor="refund_reason">Alasan pembatalan</Label>
        <Input
          id="refund_reason"
          name="reason"
          required
          minLength={3}
          maxLength={200}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={sure}
          onChange={(e) => setSure(e.target.checked)}
          className="mt-1"
        />
        <span>
          Saya mengerti: pesanan dibatalkan, pembayaran ditandai refund, dan{" "}
          <strong>stok bahan tidak dikembalikan otomatis</strong>. Refund tunai
          mengurangi kas shift saya.
        </span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary">
          {state.success}
        </p>
      )}
      <Button type="submit" variant="destructive" disabled={!sure || pending}>
        {pending ? "Memproses..." : "Batalkan dan refund"}
      </Button>
    </form>
  );
}
