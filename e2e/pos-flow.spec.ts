import { expect, test } from "@playwright/test";
import { login } from "./helpers";
test.describe.configure({ retries: 0 });

test("kasir membuat pesanan, dapur memproses, meja kosong lagi", async ({
  browser,
}) => {
  const cashier = await (await browser.newContext()).newPage();
  await login(cashier, "cashier");

  // buka shift bila belum ada
  await cashier.goto("/shifts");
  const openShift = cashier.getByRole("button", { name: "Buka shift" });
  if (await openShift.isVisible()) {
    await cashier.getByLabel("Kas awal di laci (Rp)").fill("100000");
    await openShift.click();
    await expect(cashier.getByText(/Shift terbuka sejak/)).toBeVisible();
  }

  // pesan Es Kopi Susu Large, dine-in di T5, bayar tunai pas
  await cashier.goto("/pos");
  await cashier.getByRole("button", { name: /Es Kopi Susu/ }).click();
  await cashier
    .getByRole("dialog", { name: /Es Kopi Susu/ })
    .getByRole("button", { name: /Large/ })
    .click();

  const t5 = await cashier
    .locator("option", { hasText: /^T5 ·/ })
    .getAttribute("value");
  await cashier.getByLabel("Meja").selectOption(t5!);
  await cashier.getByRole("button", { name: "Uang pas" }).click();
  await cashier.getByRole("button", { name: /^Bayar/ }).click();

  await expect(cashier).toHaveURL(/\/receipt\/.+/);
  const orderNo = ((await cashier.getByText(/^No: CF-/).textContent()) ?? "")
    .replace("No: ", "")
    .trim();
  expect(orderNo).toMatch(/^CF-\d{8}-\d{4}$/);

  // dapur
  const kitchen = await (await browser.newContext()).newPage();
  await login(kitchen, "kitchen");
  const kitchenCard = kitchen.getByRole("article", {
    name: `Pesanan ${orderNo}`,
  });
  await expect(kitchenCard).toBeVisible();
  await expect(kitchenCard.getByText(/Rp/)).toHaveCount(0); // dapur tidak melihat harga
  await kitchenCard.getByRole("button", { name: "Mulai siapkan" }).click();
  await kitchenCard.getByRole("button", { name: "Tandai siap" }).click();
  await expect(
    kitchenCard.getByText(/Menunggu diantar oleh kasir/)
  ).toBeVisible();

  // kasir mengantar, lalu pelanggan pergi
  await cashier.goto("/tables");
  const link = cashier.getByRole("link", { name: orderNo });
  await link.waitFor();
  const tableCard = () =>
    cashier.locator("div.rounded-xl", { has: link }).last();

  const deliver = tableCard().getByRole("button", {
    name: "Tandai sudah diantar",
  });
  await expect(async () => {
    await cashier.reload();
    await expect(deliver).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });

  // tunggu Server Action selesai, jangan reload di tengah request
  await Promise.all([
    cashier.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/tables")
    ),
    deliver.click(),
  ]);

  const leave = tableCard().getByRole("button", { name: "Pelanggan selesai" });
  await expect(async () => {
    await cashier.reload();
    await expect(leave).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });

  await Promise.all([
    cashier.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/tables")
    ),
    leave.click(),
  ]);

  await expect(async () => {
    await cashier.reload();
    await expect(cashier.getByRole("link", { name: orderNo })).toHaveCount(0, {
      timeout: 2000,
    });
  }).toPass({ timeout: 20_000 });
  await expect(
    kitchen.getByRole("article", { name: `Pesanan ${orderNo}` })
  ).toHaveCount(0, { timeout: 15_000 });
});

test("tunai kurang dari total ditolak di POS", async ({ page }) => {
  await login(page, "cashier");
  await page.goto("/pos");
  await page.getByRole("button", { name: /Kentang Goreng/ }).click();
  await page.getByRole("button", { name: "Takeaway" }).click();
  await page.getByLabel("Uang diterima (Rp)").fill("1000");
  await page.getByRole("button", { name: /^Bayar/ }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("kurang");
});

test.describe("akses route per role", () => {
  test("belum login diarahkan ke /login", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("cashier tidak bisa membuka dashboard dan audit log", async ({
    page,
  }) => {
    await login(page, "cashier");
    for (const path of ["/dashboard", "/audit-logs", "/users", "/inventory"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/pos$/);
    }
  });

  test("kitchen hanya bisa membuka KDS", async ({ page }) => {
    await login(page, "kitchen");
    for (const path of ["/pos", "/orders", "/tables", "/reports"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/kitchen$/);
    }
  });

  test("manager tidak bisa membuka audit log dan pengguna", async ({
    page,
  }) => {
    await login(page, "manager");
    for (const path of ["/audit-logs", "/users", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
    }
  });
});
