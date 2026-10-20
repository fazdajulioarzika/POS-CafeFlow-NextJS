import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (
  !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(supabaseUrl) &&
  process.env.ALLOW_REMOTE_TEST !== "yes"
) {
  throw new Error(
    "E2E hanya boleh berjalan ke Supabase lokal. Isi .env.test.local (lihat README)."
  );
}

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // build + start: NEXT_PUBLIC_* ikut tertanam, dan tidak bentrok dengan `npm run dev` milikmu
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
