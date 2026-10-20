import { expect, type Page } from "@playwright/test";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  type DemoRole,
} from "../scripts/demo-accounts";

export async function login(page: Page, role: DemoRole) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO_ACCOUNTS[role].email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
