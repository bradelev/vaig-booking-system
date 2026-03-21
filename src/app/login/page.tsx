import { login } from "./actions";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-bold">Iniciar sesión</h1>
        <LoginForm error={error} loginAction={login} />
      </div>
    </main>
  );
}
