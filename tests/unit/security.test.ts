import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const norm = (p: string) => p.replaceAll("\\", "/");
const files = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
const text = (f: string) => readFileSync(f, "utf8");

describe("keamanan statis", () => {
  it("service role key hanya dibaca di lib/supabase/admin.ts", () => {
    const offenders = files.filter(
      (f) =>
        text(f).includes("SUPABASE_SERVICE_ROLE_KEY") &&
        !norm(f).endsWith("src/lib/supabase/admin.ts")
    );
    expect(offenders).toEqual([]);
  });

  it("tidak ada variabel service role berprefiks NEXT_PUBLIC_", () => {
    const offenders = files.filter((f) =>
      /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(text(f))
    );
    expect(offenders).toEqual([]);
  });

  it("client component tidak mengimpor admin client", () => {
    const offenders = files.filter(
      (f) =>
        /^\s*['"]use client['"]/.test(text(f)) &&
        text(f).includes("supabase/admin")
    );
    expect(offenders).toEqual([]);
  });

  it("tidak memakai dangerouslySetInnerHTML", () => {
    expect(
      files.filter((f) => text(f).includes("dangerouslySetInnerHTML"))
    ).toEqual([]);
  });

  it(".env* ada di .gitignore", () => {
    expect(readFileSync(".gitignore", "utf8")).toMatch(/^\.env/m);
  });
});
