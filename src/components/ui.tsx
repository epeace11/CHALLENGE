import type { ReactNode } from "react";

export function Section({ id, title, subtitle, children, action }: {
  id?: string; title: string; subtitle?: string; children: ReactNode; action?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16">
      <div className="mb-2 flex items-end justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-6 text-center text-sm text-muted">{children}</div>;
}
