import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toCsv } from "@/lib/csv";
import { addDays, resolveRange } from "@/lib/range";

describe("toCsv", () => {
  it("memakai BOM, CRLF, dan angka apa adanya", () => {
    expect(toCsv(["a", "b"], [["x", 1]])).toBe("\uFEFFa,b\r\nx,1\r\n");
  });
  it("mengutip koma, tanda kutip, dan baris baru", () => {
    expect(toCsv(["h"], [["a,b"], ['say "hi"'], ["l1\nl2"]])).toContain(
      '"a,b"'
    );
    expect(toCsv(["h"], [['say "hi"']])).toContain('"say ""hi"""');
    expect(toCsv(["h"], [["l1\nl2"]])).toContain('"l1\nl2"');
  });
  it("menetralkan formula injection pada teks", () => {
    for (const evil of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
      expect(toCsv(["h"], [[evil]])).toContain(`'${evil}`);
    }
  });
  it("angka negatif sungguhan tidak diubah", () => {
    expect(toCsv(["h"], [[-5]])).toContain("\r\n-5\r\n");
  });
  it("null menjadi sel kosong", () => {
    expect(toCsv(["a", "b"], [[null, "x"]])).toContain("\r\n,x\r\n");
  });
});

describe("addDays", () => {
  it("melewati batas bulan dan tahun kabisat", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("resolveRange (zona Asia/Jakarta)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 17 Okt 2026 17:30 UTC = 18 Okt 2026 00:30 WIB
    vi.setSystemTime(new Date("2026-10-17T17:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it('"hari ini" mengikuti tanggal Jakarta, bukan UTC', () => {
    const r = resolveRange({ range: "today" });
    expect(r.from).toBe("2026-10-18");
    expect(r.to).toBe("2026-10-18");
    expect(r.fromIso).toBe("2026-10-17T17:00:00.000Z");
    expect(r.toIso).toBe("2026-10-18T17:00:00.000Z");
  });
  it("kemarin, 7 hari, bulan ini", () => {
    expect(resolveRange({ range: "yesterday" }).from).toBe("2026-10-17");
    expect(resolveRange({ range: "7d" }).from).toBe("2026-10-12");
    expect(resolveRange({ range: "month" }).from).toBe("2026-10-01");
  });
  it("rentang khusus terbalik ditukar", () => {
    const r = resolveRange({
      range: "custom",
      from: "2026-10-10",
      to: "2026-10-05",
    });
    expect([r.from, r.to]).toEqual(["2026-10-05", "2026-10-10"]);
  });
  it("rentang khusus tidak valid kembali ke hari ini", () => {
    const r = resolveRange({ range: "custom", from: "abc", to: "2026-13-45" });
    expect(r.preset).toBe("today");
  });
  it("rentang dibatasi sekitar satu tahun", () => {
    const r = resolveRange({
      range: "custom",
      from: "2020-01-01",
      to: "2026-10-18",
    });
    expect(r.from).toBe(addDays(r.to, -366));
  });
});
