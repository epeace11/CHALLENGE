import Link from "next/link";
import { requireSession } from "@/lib/data";
import { signOut } from "@/app/actions/auth";
import { slugColor } from "@/lib/derive";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireSession();
  const color = slugColor(me.slug);
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="text-base font-extrabold tracking-tight">🏆 Challenge</Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/admin" className="rounded-lg px-2 py-1 text-muted hover:bg-line">Settings</Link>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color.soft} ${color.text}`}>{me.display_name}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-line">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-24 pt-4 sm:px-4">{children}</main>
    </>
  );
}
