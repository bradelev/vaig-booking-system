import { login } from "./actions";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#5a7a6a] items-center justify-center p-12">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-tight">VAIG</h1>
          <p className="mt-2 text-sm font-semibold text-white/40 uppercase tracking-[0.3em]">Studio</p>
          <div className="mt-6 h-px w-16 mx-auto bg-white/20" />
          <p className="mt-6 text-lg text-white/70">
            Sistema de gestión integral para tu negocio
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-3xl font-bold text-[#5a7a6a]">VAIG</h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.3em]">Studio</p>
          </div>

          <h2 className="text-2xl font-bold text-foreground">Bienvenido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresá tus credenciales para continuar
          </p>
          <div className="mt-6">
            <LoginForm error={error} loginAction={login} />
          </div>
        </div>
      </div>
    </main>
  );
}
