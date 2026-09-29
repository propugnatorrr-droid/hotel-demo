import { cn } from '@/lib/utils';

/** The dark Ionian hero used at the top of every module page. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative overflow-hidden rounded-2xl bg-ionian-950 px-7 py-12 text-limestone-50 md:px-14 md:py-20', className)}>
      <div className="pointer-events-none absolute -top-40 -right-20 size-[28rem] rounded-full bg-ionian-500/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-48 left-10 size-[26rem] rounded-full bg-gold-400/10 blur-[110px]" />
      <div className="bg-qilim pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_left,black,transparent_60%)]" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">{eyebrow}</p>
          <h1 className="font-display mt-6 text-5xl tracking-tight md:text-7xl">{title}</h1>
          {subtitle && <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ionian-200">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body, className }: { title: string; body?: string; className?: string }) {
  return (
    <div className={cn('bg-qilim rounded-xl border border-dashed border-border-strong px-6 py-16 text-center', className)}>
      <p className="font-serif text-2xl text-muted">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm text-subtle">{body}</p>}
    </div>
  );
}
