"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: FormState = {};

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    initial
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Lupa kata sandi</CardTitle>
          <CardDescription>
            Kami kirim tautan reset ke email kamu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
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
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Mengirim..." : "Kirim tautan"}
            </Button>
            <Link
              href="/login"
              className="block text-center text-sm text-muted-foreground underline"
            >
              Kembali ke login
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
