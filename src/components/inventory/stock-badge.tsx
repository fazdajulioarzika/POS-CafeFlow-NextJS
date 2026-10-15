import { AlertOctagon, AlertTriangle, Check } from "lucide-react";

export function stockState(stock: number, min: number) {
  if (stock <= 0)
    return {
      level: "out",
      label: "Habis",
      cls: "bg-red-100 text-red-900",
      Icon: AlertOctagon,
    };
  if (stock <= min)
    return {
      level: "low",
      label: "Rendah",
      cls: "bg-amber-100 text-amber-900",
      Icon: AlertTriangle,
    };
  return {
    level: "ok",
    label: "Aman",
    cls: "bg-emerald-100 text-emerald-900",
    Icon: Check,
  };
}

export function StockBadge({ stock, min }: { stock: number; min: number }) {
  const s = stockState(stock, min);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      <s.Icon className="h-3.5 w-3.5" aria-hidden />
      {s.label}
    </span>
  );
}
