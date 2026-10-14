"use client";

import { useActionState } from "react";
import {
  createUser,
  type UserFormState,
} from "@/app/(dashboard)/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: UserFormState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, initial);

  return (
    <form action={action} className="grid max-w-md gap-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nama lengkap</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi awal</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="cashier"
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="cashier">Cashier</option>
          <option value="kitchen">Kitchen</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
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
        {pending ? "Membuat..." : "Buat user"}
      </Button>
    </form>
  );
}
