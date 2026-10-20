"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    updatePassword,
    {} as FormState
  );
  return (
    <form action={action} className="grid max-w-md gap-4">
      <div className="space-y-2">
        <Label htmlFor="pw">Kata sandi baru</Label>
        <Input
          id="pw"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw2">Konfirmasi</Label>
        <Input
          id="pw2"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Setelah disimpan, kamu diarahkan ke halaman awal.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
