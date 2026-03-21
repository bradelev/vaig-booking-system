"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
    >
      {pending ? "Ingresando..." : "Ingresar"}
    </button>
  );
}

interface LoginFormProps {
  error?: string;
  loginAction: (formData: FormData) => Promise<void>;
}

export default function LoginForm({ error, loginAction }: LoginFormProps) {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Email o contraseña incorrectos. Intentá de nuevo.
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
