"use client";
import { useActionState } from "react";
import { signIn, type ActionState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  return (
    <form action={action} className="card flex flex-col gap-3 p-5">
      <label className="text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="email" required className="input mt-1" />
      </label>
      <label className="text-sm font-medium">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="input mt-1" />
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary mt-1">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
