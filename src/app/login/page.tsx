import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="text-5xl">🏆</div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Challenge Tracker</h1>
        <p className="mt-1 text-sm text-muted">Sign in to log your day.</p>
      </div>
      <LoginForm />
    </main>
  );
}
