"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/(dashboard)/settings/actions";
import type { ActionState } from "@/types/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = {
  cafe_name: string;
  address: string | null;
  phone: string | null;
  tax_percent: number;
  receipt_footer: string | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(
    saveSettings,
    {} as ActionState
  );

  return (
    <form action={action} className="grid max-w-md gap-4">
      <div className="space-y-2">
        <Label htmlFor="cafe_name">Nama kafe</Label>
        <Input
          id="cafe_name"
          name="cafe_name"
          defaultValue={settings.cafe_name}
          required
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Alamat</Label>
        <Input
          id="address"
          name="address"
          defaultValue={settings.address ?? ""}
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telepon</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={settings.phone ?? ""}
          maxLength={30}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tax_percent">Pajak (%) — default 0</Label>
        <Input
          id="tax_percent"
          name="tax_percent"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={settings.tax_percent}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt_footer">Catatan kaki struk</Label>
        <Input
          id="receipt_footer"
          name="receipt_footer"
          defaultValue={settings.receipt_footer ?? ""}
          maxLength={200}
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
