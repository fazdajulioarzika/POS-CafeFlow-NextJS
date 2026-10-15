const tone: Record<string, string> = {
  draft: "bg-secondary text-foreground",
  placed: "bg-blue-100 text-blue-900",
  preparing: "bg-amber-100 text-amber-900",
  ready: "bg-blue-100 text-blue-900",
  served: "bg-sky-100 text-sky-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
  unpaid: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  refunded: "bg-red-100 text-red-900",
};

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        tone[value] ?? "bg-secondary"
      }`}
    >
      {label}
    </span>
  );
}
