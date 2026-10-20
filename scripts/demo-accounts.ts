export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345!";

export const DEMO_ACCOUNTS = {
  owner: { email: "owner@example.com", name: "Budi Owner" },
  manager: { email: "manager@example.com", name: "Sari Manager" },
  cashier: { email: "cashier@example.com", name: "Andi Kasir" },
  kitchen: { email: "kitchen@example.com", name: "Rina Dapur" },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;
