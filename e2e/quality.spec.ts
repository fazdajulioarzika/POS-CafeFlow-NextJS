import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const PAGES = [
  "/dashboard",
  "/pos",
  "/orders",
  "/kitchen",
  "/tables",
  "/products",
  "/categories",
  "/inventory",
  "/recipes",
  "/reports",
  "/shifts",
  "/users",
  "/settings",
  "/audit-logs",
];

async function settle(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

for (const vp of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 820, height: 1180 },
]) {
  test(`tanpa scroll horizontal di ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await login(page, "owner");

    const overflowing: string[] = [];
    for (const path of PAGES) {
      await settle(page, path);
      const extra = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      if (extra > 0) overflowing.push(`${path} (+${extra}px)`);
    }
    expect(overflowing).toEqual([]);
  });
}

test("login tanpa pelanggaran aksesibilitas serius", async ({ page }) => {
  await page.goto("/login");
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id)
  ).toEqual([]);
});

test("halaman owner tanpa pelanggaran aksesibilitas serius", async ({
  page,
}) => {
  await login(page, "owner");
  const found: string[] = [];
  for (const path of PAGES) {
    await settle(page, path);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    for (const v of r.violations) {
      if (v.impact === "serious" || v.impact === "critical")
        found.push(`${path} → ${v.id} (${v.nodes.length} elemen)`);
    }
  }
  expect(found).toEqual([]);
});
