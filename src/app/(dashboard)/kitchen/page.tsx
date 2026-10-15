import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KdsBoard, type Ticket } from "@/components/kitchen/kds-board";

export default async function KitchenPage() {
  const me = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("kitchen_tickets")
    .select(
      "order_id, order_number, order_type, table_number, status, items, created_at, started_at, ready_at"
    )
    .in("status", ["placed", "preparing", "ready"])
    .order("created_at", { ascending: true });

  return (
    <KdsBoard
      initial={(data ?? []) as unknown as Ticket[]}
      canComplete={me.role !== "kitchen"}
    />
  );
}
