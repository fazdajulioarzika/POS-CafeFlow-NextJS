export type ActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string>; // supaya input tidak hilang saat validasi gagal
};
