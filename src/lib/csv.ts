type Cell = string | number | null | undefined;

function csvCell(v: Cell) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // cegah formula injection di Excel/Sheets
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return (
    "\uFEFF" +
    [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
